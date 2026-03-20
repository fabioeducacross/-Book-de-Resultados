'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { generateBook } = require('../../packages/book-de-resultados/src/index');

describe('generateBook — inputData (JSON API mode)', () => {
  let tmpDir;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-json-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const jsonPayload = {
    metadata: {
      municipio: 'Canoas',
      ano: 2025,
      ciclo: '2025_sem2',
      data: '2025-12-01',
      nome_rede: 'Rede Municipal de Canoas',
      qtd_escolas: 2,
      alunos_previstos: 200,
      alunos_iniciaram: 180,
      alunos_finalizaram: 170,
    },
    escolas: [
      {
        id_escola: '1',
        nome_escola: 'EMEF Alpha',
        alunos_previstos: 100,
        alunos_iniciaram: 95,
        alunos_finalizaram: 90,
        participacao_total: 90,
      },
      {
        id_escola: '2',
        nome_escola: 'EMEF Beta',
        alunos_previstos: 100,
        alunos_iniciaram: 85,
        alunos_finalizaram: 80,
        participacao_total: 80,
      },
    ],
    resultados: [
      { id_escola: '1', ano: '2º ano', disciplina: 'Matemática', media: 72.5, participacao: 90 },
      { id_escola: '1', ano: '2º ano', disciplina: 'Língua Portuguesa', media: 68.0, participacao: 90 },
      { id_escola: '2', ano: '2º ano', disciplina: 'Matemática', media: 65.3, participacao: 80 },
      { id_escola: '2', ano: '2º ano', disciplina: 'Língua Portuguesa', media: 70.1, participacao: 80 },
    ],
    distribuicao: [
      { id_escola: '1', nivel: 'abaixo_do_basico', alunos: 10 },
      { id_escola: '1', nivel: 'basico', alunos: 25 },
      { id_escola: '1', nivel: 'adequado', alunos: 35 },
      { id_escola: '1', nivel: 'avancado', alunos: 20 },
      { id_escola: '2', nivel: 'abaixo_do_basico', alunos: 15 },
      { id_escola: '2', nivel: 'basico', alunos: 30 },
      { id_escola: '2', nivel: 'adequado', alunos: 25 },
      { id_escola: '2', nivel: 'avancado', alunos: 10 },
    ],
  };

  test('generates JSON output from inputData payload', async () => {
    const result = await generateBook({
      inputData: jsonPayload,
      outputDir: tmpDir,
      format: 'json',
      version: 'v1',
    });

    expect(result.success).toBe(true);
    expect(result.pageCount).toBeGreaterThan(0);
    expect(result.outputFile).toMatch(/\.json$/);
    expect(fs.existsSync(result.outputFile)).toBe(true);

    const log = result.log;
    const parseStep = log.find((l) => l.step === 'parse');
    expect(parseStep.inputType).toBe('json');
  });

  test('rejects when both inputFile and inputData are provided', async () => {
    await expect(
      generateBook({
        inputFile: '/fake/path.xlsx',
        inputData: jsonPayload,
        outputDir: tmpDir,
        format: 'json',
      }),
    ).rejects.toThrow('inputFile" ou "inputData"');
  });

  test('rejects when neither inputFile nor inputData are provided', async () => {
    await expect(
      generateBook({ outputDir: tmpDir, format: 'json' }),
    ).rejects.toThrow('inputFile" ou "inputData"');
  });

  test('rejects invalid JSON payload shape', async () => {
    await expect(
      generateBook({
        inputData: { metadata: { municipio: 'X' } },
        outputDir: tmpDir,
        format: 'json',
      }),
    ).rejects.toThrow('Payload JSON inválido');
  });

  test('pipeline log records inputType=json', async () => {
    const result = await generateBook({
      inputData: jsonPayload,
      outputDir: tmpDir,
      format: 'json',
      version: 'v2',
    });

    const parseLog = result.log.find((l) => l.step === 'parse' && l.status === 'ok');
    expect(parseLog.inputType).toBe('json');
  });
});
