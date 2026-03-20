'use strict';

const { adaptJsonPayload, validatePayloadShape, API_SOURCE_LAYOUT } = require('../../packages/book-de-resultados/src/input-adapter');

describe('input-adapter — adaptJsonPayload', () => {
  const validPayload = {
    metadata: {
      municipio: 'Canoas',
      ano: 2025,
      ciclo: '2025-sem2',
      data: '2025-12-01',
    },
    escolas: [
      { id_escola: '1', nome_escola: 'EMEF Alpha' },
      { id_escola: '2', nome_escola: 'EMEF Beta' },
    ],
    resultados: [
      { id_escola: '1', ano: '2º ano', disciplina: 'Matemática', media: 72.5, participacao: 95 },
      { id_escola: '2', ano: '2º ano', disciplina: 'Matemática', media: 68.3, participacao: 88 },
    ],
    distribuicao: [
      { id_escola: '1', nivel: 'adequado', alunos: 30 },
      { id_escola: '1', nivel: 'basico', alunos: 20 },
    ],
  };

  test('adapts a valid canonical payload without mutations', () => {
    const result = adaptJsonPayload(validPayload);

    expect(result.metadata.municipio).toBe('Canoas');
    expect(result.metadata.ano).toBe(2025);
    expect(result.escolas).toHaveLength(2);
    expect(result.resultados).toHaveLength(2);
    expect(result.distribuicao).toHaveLength(2);
    expect(result.source.layout).toBe(API_SOURCE_LAYOUT);
    expect(result.source.inputType).toBe('json');
    expect(result.source.trace.escolas).toBe(2);
  });

  test('resolves English field aliases to canonical names', () => {
    const payload = {
      meta: { municipality: 'Canoas', year: 2025, cycle: '2025-sem2', date: '2025-12-01' },
      schools: [{ school_id: '1', school_name: 'EMEF Alpha' }],
      results: [{ school_id: '1', year: '2º ano', subject: 'Matemática', average: 72.5, participation: 95 }],
      distribution: [{ school_id: '1', level: 'adequado', students: 30 }],
    };

    const result = adaptJsonPayload(payload);
    expect(result.metadata.municipio).toBe('Canoas');
    expect(result.metadata.ano).toBe(2025);
    expect(result.escolas[0].id_escola).toBe('1');
    expect(result.escolas[0].nome_escola).toBe('EMEF Alpha');
    expect(result.resultados[0].disciplina).toBe('Matemática');
    expect(result.distribuicao[0].nivel).toBe('adequado');
    expect(result.distribuicao[0].alunos).toBe(30);
  });

  test('coerces string numbers to numeric values', () => {
    const payload = {
      metadata: { municipio: 'Canoas', ano: '2025', ciclo: '2025-sem2', data: '2025-12-01' },
      escolas: [{ id_escola: '1', nome_escola: 'EMEF Alpha', alunos_previstos: '100' }],
      resultados: [{ id_escola: '1', ano: '2º ano', disciplina: 'Mat', media: '72.5', participacao: '95' }],
      distribuicao: [{ id_escola: '1', nivel: 'adequado', alunos: '30' }],
    };

    const result = adaptJsonPayload(payload);
    expect(result.resultados[0].media).toBe(72.5);
    expect(result.resultados[0].participacao).toBe(95);
    expect(result.distribuicao[0].alunos).toBe(30);
    expect(result.escolas[0].alunos_previstos).toBe(100);
  });

  test('includes habilidades when present', () => {
    const payload = {
      ...validPayload,
      habilidades: [
        {
          area_conhecimento: 'Matemática',
          ano_escolar: '2º ano',
          codigo_habilidade: 'H01',
          habilidade: 'Resolver problemas',
          desempenho_percentual: 75,
        },
      ],
    };

    const result = adaptJsonPayload(payload);
    expect(result.habilidades).toHaveLength(1);
    expect(result.habilidades[0].codigo_habilidade).toBe('H01');
    expect(result.source.trace.habilidades).toBe(1);
  });

  test('omits habilidades key when array is empty', () => {
    const result = adaptJsonPayload(validPayload);
    expect(result).not.toHaveProperty('habilidades');
  });

  test('passes through extra metadata fields', () => {
    const payload = {
      ...validPayload,
      metadata: { ...validPayload.metadata, custom_field: 'custom_value' },
    };

    const result = adaptJsonPayload(payload);
    expect(result.metadata.custom_field).toBe('custom_value');
  });

  test('passes through extra escola fields', () => {
    const payload = {
      ...validPayload,
      escolas: [{ id_escola: '1', nome_escola: 'EMEF Alpha', etapa: 'fundamental' }],
    };

    const result = adaptJsonPayload(payload);
    expect(result.escolas[0].etapa).toBe('fundamental');
  });

  test('throws on null payload', () => {
    expect(() => adaptJsonPayload(null)).toThrow('Payload inválido');
  });

  test('throws on non-object row', () => {
    const payload = {
      metadata: validPayload.metadata,
      escolas: ['invalid'],
      resultados: validPayload.resultados,
      distribuicao: validPayload.distribuicao,
    };

    expect(() => adaptJsonPayload(payload)).toThrow('escolas[0]: registro inválido');
  });

  test('source has receivedAt ISO timestamp', () => {
    const before = new Date().toISOString();
    const result = adaptJsonPayload(validPayload);
    const after = new Date().toISOString();

    expect(result.source.receivedAt >= before).toBe(true);
    expect(result.source.receivedAt <= after).toBe(true);
  });
});

describe('input-adapter — validatePayloadShape', () => {
  test('valid payload passes shape check', () => {
    const { valid, errors } = validatePayloadShape({
      metadata: { municipio: 'X' },
      escolas: [{ id: 1 }],
      resultados: [{ id: 1 }],
      distribuicao: [{ id: 1 }],
    });
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test('rejects null payload', () => {
    const { valid, errors } = validatePayloadShape(null);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/objeto JSON/);
  });

  test('reports all missing required sections at once', () => {
    const { valid, errors } = validatePayloadShape({});
    expect(valid).toBe(false);
    expect(errors).toHaveLength(4); // metadata, escolas, resultados, distribuicao
  });

  test('rejects empty arrays', () => {
    const { valid, errors } = validatePayloadShape({
      metadata: { municipio: 'X' },
      escolas: [],
      resultados: [],
      distribuicao: [],
    });
    expect(valid).toBe(false);
    expect(errors).toHaveLength(3);
  });

  test('accepts English aliases', () => {
    const { valid } = validatePayloadShape({
      meta: { municipality: 'X' },
      schools: [{ id: 1 }],
      results: [{ id: 1 }],
      distribution: [{ id: 1 }],
    });
    expect(valid).toBe(true);
  });
});
