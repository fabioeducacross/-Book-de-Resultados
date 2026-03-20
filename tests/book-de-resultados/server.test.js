'use strict';

const { buildApp } = require('../../packages/book-de-resultados/server/app');

describe('Book de Resultados — HTTP Server', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp({
      logLevel: 'silent',
      storage: { driver: 'local', localDir: require('os').tmpdir() + '/book-test-server' },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    const fs = require('fs');
    const dir = require('os').tmpdir() + '/book-test-server';
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('GET /health', () => {
    test('returns 200 with status ok', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('book-de-resultados');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
    });
  });

  describe('GET /stats', () => {
    test('returns queue statistics', async () => {
      const response = await app.inject({ method: 'GET', url: '/stats' });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.queue).toHaveProperty('queued');
      expect(body.queue).toHaveProperty('processing');
      expect(body.queue).toHaveProperty('completed');
      expect(body.queue).toHaveProperty('failed');
      expect(body.storage.driver).toBe('local');
    });
  });

  describe('POST /generate', () => {
    const validPayload = {
      data: {
        metadata: {
          municipio: 'Canoas',
          ano: 2025,
          ciclo: '2025_sem2',
          data: '2025-12-01',
          nome_rede: 'Rede Municipal de Canoas',
          qtd_escolas: 1,
          alunos_previstos: 100,
          alunos_iniciaram: 90,
          alunos_finalizaram: 85,
        },
        escolas: [
          {
            id_escola: '1',
            nome_escola: 'EMEF Alpha',
            alunos_previstos: 100,
            alunos_iniciaram: 90,
            alunos_finalizaram: 85,
            participacao_total: 85,
          },
        ],
        resultados: [
          { id_escola: '1', ano: '2º ano', disciplina: 'Matemática', media: 72.5, participacao: 85 },
          { id_escola: '1', ano: '2º ano', disciplina: 'Língua Portuguesa', media: 68.0, participacao: 85 },
        ],
        distribuicao: [
          { id_escola: '1', nivel: 'abaixo_do_basico', alunos: 10 },
          { id_escola: '1', nivel: 'basico', alunos: 25 },
          { id_escola: '1', nivel: 'adequado', alunos: 35 },
          { id_escola: '1', nivel: 'avancado', alunos: 15 },
        ],
      },
    };

    test('returns 202 with jobId for valid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/generate',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(202);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('jobId');
      expect(body.status).toBe('queued');
      expect(body.statusUrl).toMatch(/\/status\//);
      expect(body).toHaveProperty('message');
    });

    test('returns 400 for missing data field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/generate',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    test('returns 400 for invalid data shape', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/generate',
        payload: {
          data: { metadata: { municipio: 'X' } },
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toMatch(/inválido/);
      expect(body.details).toBeInstanceOf(Array);
      expect(body.details.length).toBeGreaterThan(0);
    });

    test('accepts webhookUrl and version', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/generate',
        payload: {
          ...validPayload,
          webhookUrl: 'https://example.com/webhook',
          version: 'v2',
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('jobId');
    });
  });

  describe('GET /status/:jobId', () => {
    test('returns 404 for unknown jobId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/status/nonexistent-job',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toMatch(/não encontrado/);
    });

    test('returns job status after enqueue', async () => {
      // First, enqueue a job
      const genResponse = await app.inject({
        method: 'POST',
        url: '/generate',
        payload: {
          data: {
            metadata: { municipio: 'Test', ano: 2025, ciclo: 't1', data: '2025-01-01' },
            escolas: [{ id_escola: '1', nome_escola: 'A' }],
            resultados: [{ id_escola: '1', ano: '2', disciplina: 'M', media: 50, participacao: 90 }],
            distribuicao: [{ id_escola: '1', nivel: 'basico', alunos: 10 }],
          },
        },
      });
      const { jobId } = JSON.parse(genResponse.body);

      // Check status
      const response = await app.inject({
        method: 'GET',
        url: `/status/${jobId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.jobId).toBe(jobId);
      expect(['queued', 'processing', 'completed', 'failed']).toContain(body.status);
      expect(body).toHaveProperty('createdAt');
    });
  });

  describe('GET /download/:jobId', () => {
    test('returns 404 for unknown jobId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/download/nonexistent-job',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
