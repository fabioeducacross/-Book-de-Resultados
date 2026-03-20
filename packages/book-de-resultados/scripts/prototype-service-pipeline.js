'use strict';

const fs = require('fs');
const path = require('path');

const { buildApp } = require('../server/app');

function parseArgs(argv) {
  const args = {
    port: 3110,
    host: '127.0.0.1',
    timeoutMs: 180000,
    pollMs: 1200,
    version: 'v1-prototype',
    payloadPath: path.resolve(__dirname, '../examples/prototype-payload.json'),
    outputDir: path.resolve(__dirname, '../prototype-output'),
    browserPath: process.env.BOOK_DE_RESULTADOS_PDF_BROWSER || null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--payload' && next) {
      args.payloadPath = path.resolve(next);
      i++;
    } else if (token === '--output' && next) {
      args.outputDir = path.resolve(next);
      i++;
    } else if (token === '--port' && next) {
      args.port = Number(next);
      i++;
    } else if (token === '--timeoutMs' && next) {
      args.timeoutMs = Number(next);
      i++;
    } else if (token === '--pollMs' && next) {
      args.pollMs = Number(next);
      i++;
    } else if (token === '--version' && next) {
      args.version = String(next);
      i++;
    } else if (token === '--browserPath' && next) {
      args.browserPath = path.resolve(next);
      i++;
    }
  }

  return args;
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady(baseUrl, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (_) {
      // Ignore until timeout
    }
    await delay(350);
  }

  throw new Error('Timeout aguardando o servidor responder /health');
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.payloadPath)) {
    throw new Error(`Arquivo de payload nao encontrado: ${args.payloadPath}`);
  }

  if (args.browserPath) {
    process.env.BOOK_DE_RESULTADOS_PDF_BROWSER = args.browserPath;
  }

  fs.mkdirSync(args.outputDir, { recursive: true });

  const storageDir = path.join(args.outputDir, 'storage');
  fs.mkdirSync(storageDir, { recursive: true });

  const app = await buildApp({
    host: args.host,
    port: args.port,
    logLevel: 'info',
    storage: {
      driver: 'local',
      localDir: storageDir,
      s3: {
        bucket: '',
        region: 'us-east-1',
        prefix: 'books/',
      },
    },
  });

  let baseUrl = '';
  let finalPdfPath = null;

  try {
    await app.listen({ host: args.host, port: args.port });
    baseUrl = `http://${args.host}:${args.port}`;

    console.log(`[prototype] servidor iniciado em ${baseUrl}`);
    console.log(`[prototype] payload: ${args.payloadPath}`);

    await waitForReady(baseUrl, 10000);

    const payload = JSON.parse(fs.readFileSync(args.payloadPath, 'utf-8'));

    const generateResponse = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data: payload,
        version: args.version,
      }),
    });

    const generateBody = await generateResponse.json();

    if (generateResponse.status !== 202) {
      throw new Error(`Falha no /generate (${generateResponse.status}): ${JSON.stringify(generateBody)}`);
    }

    const jobId = generateBody.jobId;
    console.log(`[prototype] job criado: ${jobId}`);

    const started = Date.now();
    let statusBody = null;

    while (Date.now() - started < args.timeoutMs) {
      const statusResponse = await fetch(`${baseUrl}/status/${jobId}`);
      statusBody = await statusResponse.json();

      console.log(`[prototype] status: ${statusBody.status}`);

      if (statusBody.status === 'completed') {
        break;
      }

      if (statusBody.status === 'failed') {
        throw new Error(`Job falhou: ${statusBody.error || 'erro desconhecido'}`);
      }

      await delay(args.pollMs);
    }

    if (!statusBody || statusBody.status !== 'completed') {
      throw new Error(`Timeout aguardando job ${jobId} finalizar`);
    }

    const downloadResponse = await fetch(`${baseUrl}/download/${jobId}`);

    if (!downloadResponse.ok) {
      const txt = await downloadResponse.text();
      throw new Error(`Falha no download (${downloadResponse.status}): ${txt}`);
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filename = (statusBody.result && statusBody.result.filename) || `${jobId}.pdf`;
    finalPdfPath = path.join(args.outputDir, filename);
    fs.writeFileSync(finalPdfPath, buffer);

    console.log('[prototype] pipeline concluido com sucesso');
    console.log(`[prototype] pdf salvo em: ${finalPdfPath}`);
    console.log(`[prototype] paginas: ${statusBody.result && statusBody.result.pageCount}`);
    console.log(`[prototype] duracao: ${statusBody.result && statusBody.result.durationMs}ms`);
  } finally {
    await app.close();
    console.log('[prototype] servidor encerrado');
  }

  return finalPdfPath;
}

run().catch((err) => {
  console.error(`[prototype] erro: ${err.message}`);
  process.exit(1);
});
