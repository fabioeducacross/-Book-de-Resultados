#!/usr/bin/env node

/**
 * Teste E2E: Validar novo fluxo de listagem + geração de relatório
 * 
 * Fluxo:
 * 1. Simula seleção de avaliação na tabela
 * 2. POST /generate com dados completos
 * 3. Poll /status/:jobId até concluir
 * 4. GET /download/:jobId para obter PDF
 * 5. Valida sucesso
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://127.0.0.1:3100';
const OUTPUT_DIR = path.join(__dirname, '../prototype-output');

console.log('[e2e-listagem] iniciando teste do novo fluxo de listagem...\n');

// Mock de uma avaliação selecionada na tabela
const mockSelection = {
  id: 'aval-test-001',
  rede: 'Rede Municipal',
  nome: 'Avaliação Diagnóstica - Teste E2E',
  dataAplicacao: '2025-03-19',
  area: 'Matemática',
  escolas: ['EMEF Alpha', 'EMEF Beta'],
  alunos: 220,
};

// Constrói payload no formato esperado pela API
const gerarDistribuicao = () => {
  const dist = [];
  const niveis = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
  const alunos = [
    Math.floor(mockSelection.alunos * 0.15),
    Math.floor(mockSelection.alunos * 0.25),
    Math.floor(mockSelection.alunos * 0.35),
    Math.floor(mockSelection.alunos * 0.25),
  ];
    
  mockSelection.escolas.forEach((_, escIdx) => {
    niveis.forEach((nivel, nIdx) => {
      dist.push({
        id_escola: `esc-${escIdx + 1}`,
        nivel: nivel,
        alunos: Math.floor(alunos[nIdx] / mockSelection.escolas.length),
      });
    });
  });
    
  return dist;
};

const generatePayload = {
  data: {
    metadata: {
      municipio: 'Canoas',
      titulo: mockSelection.nome,
      rede: mockSelection.rede,
      areaConhecimento: mockSelection.area,
      dataAplicacao: mockSelection.dataAplicacao,
      data: mockSelection.dataAplicacao,
      ano: 2025,
      ciclo: '2025-sem2',
    },
    escolas: mockSelection.escolas.map((nome, idx) => ({
      id_escola: `esc-${idx + 1}`,
      nome_escola: nome,
      alunos_previstos: Math.floor(mockSelection.alunos / mockSelection.escolas.length),
    })),
    resultados: mockSelection.escolas.map((nome, idx) => ({
      id_escola: `esc-${idx + 1}`,
      ano: '2º ano',
      disciplina: mockSelection.area,
      media: 70 + Math.random() * 20,
      participacao: 85 + Math.random() * 15,
    })),
    distribuicao: gerarDistribuicao(),
  },
};

async function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? require('https') : http;
        
    const request = lib.request(url, { ...options, timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (!res.statusCode.toString().startsWith('2')) {
          try {
            const error = JSON.parse(data);
            reject(new Error(`HTTP ${res.statusCode}: ${error.error || data}`));
          } catch (_error) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    });
        
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
        
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

async function runTest() {
  try {
    // Step 1: POST /generate
    console.log('[e2e-listagem] Step 1: Enviando requisição POST /generate...');
    console.log(`[e2e-listagem] seleção: ${mockSelection.nome}`);
    console.log(`[e2e-listagem] rede: ${mockSelection.rede}`);
    console.log(`[e2e-listagem] area: ${mockSelection.area}\n`);

    const generateResponse = await fetchJson(`${API_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(generatePayload),
    });

    if (!generateResponse.jobId) {
      throw new Error('Nenhum jobId recebido do /generate');
    }

    const jobId = generateResponse.jobId;
    console.log(`[e2e-listagem] ✓ Job criado: ${jobId}`);
    console.log(`[e2e-listagem] status inicial: ${generateResponse.status}\n`);

    // Step 2: Poll /status/:jobId
    console.log('[e2e-listagem] Step 2: Fazendo polling de /status/:jobId...');
        
    let attempt = 0;
    const maxAttempts = 300; // ~5 min com 1s interval
    let finalStatus = null;

    while (attempt < maxAttempts) {
      attempt++;
            
      const statusResponse = await fetchJson(`${API_BASE}/status/${jobId}`);
      const status = statusResponse.status;

      if (attempt % 5 === 0 || status === 'completed' || status === 'failed') {
        console.log(`[e2e-listagem] attempt ${attempt}: status = ${status}`);
      }

      if (status === 'completed') {
        finalStatus = statusResponse;
        console.log(`[e2e-listagem] ✓ Completado em ${attempt}s`);
        console.log(`[e2e-listagem] páginas: ${statusResponse.result?.pages || '?'}`);
        console.log(`[e2e-listagem] duração: ${statusResponse.result?.duration || '?'}ms\n`);
        break;
      }

      if (status === 'failed' || status === 'error') {
        throw new Error(`Job falhou: ${statusResponse.error || 'unknown error'}`);
      }

      // Wait 1 second before next poll
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!finalStatus) {
      throw new Error(`Timeout ao aguardar conclusão (${maxAttempts}s)`);
    }

    // Step 3: GET /download/:jobId
    console.log('[e2e-listagem] Step 3: Baixando PDF via /download/:jobId...');

    const downloadUrl = `${API_BASE}/download/${jobId}`;
    const fileResponse = await new Promise((resolve, reject) => {
      const lib = downloadUrl.startsWith('https') ? require('https') : http;
      const request = lib.get(downloadUrl, (res) => {
        if (!res.statusCode.toString().startsWith('2')) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
      });
      request.on('error', reject);
    });

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const filename = `relatorio_${mockSelection.area.toLowerCase()}_${new Date().toISOString().split('T')[0]}_e2e.pdf`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, fileResponse);

    console.log(`[e2e-listagem] ✓ PDF salvo: ${filepath}`);
    console.log(`[e2e-listagem] tamanho: ${fileResponse.length} bytes\n`);

    // Summary
    console.log('═══════════════════════════════════════════════════');
    console.log('[e2e-listagem] ✅ TESTE CONCLUÍDO COM SUCESSO');
    console.log('═══════════════════════════════════════════════════');
    console.log('Fluxo validado:');
    console.log(`  1️⃣  POST /generate → jobId: ${jobId}`);
    console.log(`  2️⃣  Poll /status/${jobId} → completed`);
    console.log(`  3️⃣  GET /download/${jobId} → ${fileResponse.length} bytes`);
    console.log('\nArtefatos:');
    console.log(`  📄 PDF: ${filepath}`);

    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    console.error('\nStack:', err.stack);
    process.exit(1);
  }
}

runTest();
