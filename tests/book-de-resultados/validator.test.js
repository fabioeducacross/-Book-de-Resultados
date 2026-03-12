'use strict';

/**
 * Tests for the Validator module — Book de Resultados
 */

const {
  validate,
  validateMetadata,
  validateEscolas,
  validateResultados,
  validateDistribuicao,
  validateHabilidades,
  validateSemanticConsistency,
} = require('../../packages/book-de-resultados/src/validator');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeValidData() {
  return {
    metadata: { municipio: 'Canoas', ano: 2025, ciclo: '2025-sem1', data: '2025-06-01' },
    escolas: [
      { id_escola: 1, nome_escola: 'Escola A', alunos_previstos: 25, alunos_iniciaram: 24, alunos_finalizaram: 23 },
      { id_escola: 2, nome_escola: 'Escola B', alunos_previstos: 20, alunos_iniciaram: 19, alunos_finalizaram: 18 },
    ],
    resultados: [
      { id_escola: 1, ano: '5', disciplina: 'Matemática', media: 250.5, participacao: 92, participantes: 23 },
      { id_escola: 2, ano: '5', disciplina: 'Matemática', media: 235.0, participacao: 90, participantes: 18 },
    ],
    distribuicao: [
      { id_escola: 1, disciplina: 'Matemática', nivel: 'abaixo_do_basico', alunos: 4 },
      { id_escola: 1, disciplina: 'Matemática', nivel: 'basico', alunos: 5 },
      { id_escola: 1, disciplina: 'Matemática', nivel: 'adequado', alunos: 8 },
      { id_escola: 1, disciplina: 'Matemática', nivel: 'avancado', alunos: 6 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'abaixo_do_basico', alunos: 3 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'basico', alunos: 5 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'adequado', alunos: 6 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'avancado', alunos: 4 },
    ],
  };
}

// ─── validate() ───────────────────────────────────────────────────────────────

describe('validate()', () => {
  test('returns valid=true for well-formed data', () => {
    const result = validate(makeValidData());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('returns valid=false when data is null', () => {
    const result = validate(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('accumulates errors from all sections', () => {
    const result = validate({ metadata: null, escolas: null, resultados: null, distribuicao: null });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  test('requires habilidades when the parsed source is the Canoas layout', () => {
    const data = makeValidData();
    data.source = { layout: 'canoas-avaliacao-digital' };

    const result = validate(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('Habilidades'))).toBe(true);
  });
});

// ─── validateMetadata() ───────────────────────────────────────────────────────

describe('validateMetadata()', () => {
  test('passes with all required fields', () => {
    const errors = [];
    validateMetadata({ municipio: 'Canoas', ano: 2025, ciclo: 'sem1', data: '2025-01-01' }, errors);
    expect(errors).toHaveLength(0);
  });

  test('errors on missing field', () => {
    const errors = [];
    validateMetadata({ municipio: 'Canoas', ano: 2025 }, errors);
    expect(errors.some((e) => e.includes('"ciclo"'))).toBe(true);
    expect(errors.some((e) => e.includes('"data"'))).toBe(true);
  });

  test('errors on empty string field', () => {
    const errors = [];
    validateMetadata({ municipio: '', ano: 2025, ciclo: 'sem1', data: '2025-01-01' }, errors);
    expect(errors.some((e) => e.includes('"municipio"'))).toBe(true);
  });

  test('errors when metadata is not an object', () => {
    const errors = [];
    validateMetadata('invalid', errors);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── validateEscolas() ────────────────────────────────────────────────────────

describe('validateEscolas()', () => {
  test('passes with valid escola records', () => {
    const errors = [];
    const warnings = [];
    validateEscolas([{ id_escola: 1, nome_escola: 'Escola A' }], errors, warnings);
    expect(errors).toHaveLength(0);
  });

  test('errors on empty array', () => {
    const errors = [];
    const warnings = [];
    validateEscolas([], errors, warnings);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('errors on duplicate id_escola', () => {
    const errors = [];
    const warnings = [];
    validateEscolas(
      [
        { id_escola: 1, nome_escola: 'Escola A' },
        { id_escola: 1, nome_escola: 'Escola B' },
      ],
      errors,
      warnings,
    );
    expect(errors.some((e) => e.includes('duplicado'))).toBe(true);
  });

  test('errors when nome_escola is missing', () => {
    const errors = [];
    const warnings = [];
    validateEscolas([{ id_escola: 1 }], errors, warnings);
    expect(errors.some((e) => e.includes('"nome_escola"'))).toBe(true);
  });

  test('warns when escola count exceeds 500', () => {
    const errors = [];
    const warnings = [];
    const escolas = Array.from({ length: 501 }, (_, i) => ({ id_escola: i + 1, nome_escola: `E${i}` }));
    validateEscolas(escolas, errors, warnings);
    expect(warnings.some((w) => w.includes('500'))).toBe(true);
  });
});

// ─── validateResultados() ─────────────────────────────────────────────────────

describe('validateResultados()', () => {
  const escolaIds = new Set(['1', '2']);
  const escolaMap = new Map([
    ['1', { id_escola: 1, alunos_previstos: 25 }],
    ['2', { id_escola: 2, alunos_previstos: 20 }],
  ]);

  test('passes with valid resultados', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [{ id_escola: 1, ano: '5', disciplina: 'Mat', media: 250, participacao: 92, participantes: 23 }],
      escolaIds,
      escolaMap,
      errors,
      warnings,
    );
    expect(errors).toHaveLength(0);
  });

  test('errors on empty array', () => {
    const errors = [];
    const warnings = [];
    validateResultados([], escolaIds, escolaMap, errors, warnings);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('errors when media is negative', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [{ id_escola: 1, ano: '5', disciplina: 'Mat', media: -10, participacao: 90, participantes: 23 }],
      escolaIds,
      escolaMap,
      errors,
      warnings,
    );
    expect(errors.some((e) => e.includes('"media"'))).toBe(true);
  });

  test('errors when participacao exceeds 100', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [{ id_escola: 1, ano: '5', disciplina: 'Mat', media: 250, participacao: 110, participantes: 23 }],
      escolaIds,
      escolaMap,
      errors,
      warnings,
    );
    expect(errors.some((e) => e.includes('"participacao"'))).toBe(true);
  });

  test('warns when id_escola not found in escolas', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [{ id_escola: 999, ano: '5', disciplina: 'Mat', media: 250, participacao: 80, participantes: 20 }],
      escolaIds,
      escolaMap,
      errors,
      warnings,
    );
    expect(warnings.some((w) => w.includes('"999"'))).toBe(true);
  });

  test('errors when the same escola/ano/disciplina appears twice', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [
        { id_escola: 1, ano: '5', disciplina: 'Mat', media: 250, participacao: 92, participantes: 23 },
        { id_escola: 1, ano: '5', disciplina: 'Mat', media: 245, participacao: 92, participantes: 23 },
      ],
      escolaIds,
      escolaMap,
      errors,
      warnings,
    );
    expect(errors.some((error) => error.includes('duplicado'))).toBe(true);
  });

  test('errors when participacao diverges from participantes and previstos', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [{ id_escola: 1, ano: '5', disciplina: 'Mat', media: 250, participacao: 80, participantes: 23 }],
      escolaIds,
      escolaMap,
      errors,
      warnings,
    );
    expect(errors.some((error) => error.includes('diverge'))).toBe(true);
  });
});

// ─── validateDistribuicao() ───────────────────────────────────────────────────

describe('validateDistribuicao()', () => {
  const escolaIds = new Set(['1']);

  test('passes with valid distribuicao', () => {
    const errors = [];
    const warnings = [];
    validateDistribuicao([{ id_escola: 1, nivel: 'adequado', alunos: 15 }], escolaIds, errors, warnings);
    expect(errors).toHaveLength(0);
  });

  test('errors on invalid nivel value', () => {
    const errors = [];
    const warnings = [];
    validateDistribuicao([{ id_escola: 1, nivel: 'excelente', alunos: 5 }], escolaIds, errors, warnings);
    expect(errors.some((e) => e.includes('"nivel"'))).toBe(true);
  });

  test('errors when alunos is negative', () => {
    const errors = [];
    const warnings = [];
    validateDistribuicao([{ id_escola: 1, nivel: 'basico', alunos: -3 }], escolaIds, errors, warnings);
    expect(errors.some((e) => e.includes('"alunos"'))).toBe(true);
  });

  test('accepts all valid nivel values', () => {
    const niveis = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
    niveis.forEach((nivel) => {
      const errors = [];
      const warnings = [];
      validateDistribuicao([{ id_escola: 1, nivel, alunos: 10 }], escolaIds, errors, warnings);
      expect(errors).toHaveLength(0);
    });
  });
});

describe('validateHabilidades()', () => {
  test('passes with valid habilidade rows', () => {
    const errors = [];
    const warnings = [];

    validateHabilidades(
      [
        {
          area_conhecimento: 'Língua Portuguesa',
          ano_escolar: '3º Ano',
          codigo_habilidade: 'LP3A1',
          tematica: 'Leitura',
          habilidade: 'Localizar informações explícitas em textos.',
          desempenho_percentual: 79.67,
        },
      ],
      'canoas-avaliacao-digital',
      errors,
      warnings,
    );

    expect(errors).toHaveLength(0);
  });

  test('errors when desempenho_percentual is outside the valid range', () => {
    const errors = [];
    const warnings = [];

    validateHabilidades(
      [
        {
          area_conhecimento: 'Matemática',
          ano_escolar: '5º Ano',
          codigo_habilidade: 'MA5A2',
          tematica: 'Números',
          habilidade: 'Resolver problemas com números naturais.',
          desempenho_percentual: 120,
        },
      ],
      'canoas-avaliacao-digital',
      errors,
      warnings,
    );

    expect(errors.some((error) => error.includes('"desempenho_percentual"'))).toBe(true);
  });

  test('warns when tematica is empty but does not fail the row', () => {
    const errors = [];
    const warnings = [];

    validateHabilidades(
      [
        {
          area_conhecimento: 'Matemática',
          ano_escolar: '5º Ano',
          codigo_habilidade: 'MA5A2',
          tematica: '',
          habilidade: 'Resolver problemas com números naturais.',
          desempenho_percentual: 64.2,
        },
      ],
      'canoas-avaliacao-digital',
      errors,
      warnings,
    );

    expect(errors).toHaveLength(0);
    expect(warnings.some((warning) => warning.includes('"tematica"'))).toBe(true);
  });
});

describe('validateSemanticConsistency()', () => {
  test('warns when metadata totals diverge from the escola sheet', () => {
    const data = makeValidData();
    data.metadata.qtd_escolas = 3;
    data.metadata.alunos_finalizaram = 50;

    const errors = [];
    const warnings = [];
    const escolaMap = new Map(data.escolas.map((escola) => [String(escola.id_escola), escola]));

    validateSemanticConsistency(data, escolaMap, errors, warnings);

    expect(errors).toHaveLength(0);
    expect(warnings.some((warning) => warning.includes('qtd_escolas'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('alunos_finalizaram'))).toBe(true);
  });

  test('errors when distribuicao totals diverge from participantes for the same school and discipline', () => {
    const data = makeValidData();
    data.distribuicao = [
      { id_escola: 1, disciplina: 'Matemática', nivel: 'abaixo_do_basico', alunos: 1 },
      { id_escola: 1, disciplina: 'Matemática', nivel: 'basico', alunos: 1 },
      { id_escola: 1, disciplina: 'Matemática', nivel: 'adequado', alunos: 1 },
      { id_escola: 1, disciplina: 'Matemática', nivel: 'avancado', alunos: 1 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'abaixo_do_basico', alunos: 3 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'basico', alunos: 5 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'adequado', alunos: 6 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'avancado', alunos: 4 },
    ];

    const result = validate(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('inconsistente'))).toBe(true);
  });

  test('warns when distribuicao has no resultado counterpart', () => {
    const data = makeValidData();
    data.distribuicao.push({ id_escola: 1, disciplina: 'Português', nivel: 'adequado', alunos: 3 });

    const result = validate(data);

    expect(result.warnings.some((warning) => warning.includes('sem resultado correspondente'))).toBe(true);
  });

  test('warns instead of failing when explicit percentual shows a partial distribution', () => {
    const data = makeValidData();
    data.distribuicao = [
      { id_escola: 1, disciplina: 'Matemática', nivel: 'abaixo_do_basico', alunos: 4, percentual: 10 },
      { id_escola: 1, disciplina: 'Matemática', nivel: 'basico', alunos: 6, percentual: 15 },
      { id_escola: 1, disciplina: 'Matemática', nivel: 'adequado', alunos: 5, percentual: 12 },
      { id_escola: 1, disciplina: 'Matemática', nivel: 'avancado', alunos: 3, percentual: 8 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'abaixo_do_basico', alunos: 3, percentual: 15 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'basico', alunos: 5, percentual: 25 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'adequado', alunos: 6, percentual: 30 },
      { id_escola: 2, disciplina: 'Matemática', nivel: 'avancado', alunos: 4, percentual: 20 },
    ];

    const result = validate(data);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('cobertura parcial'))).toBe(true);
  });

  test('errors when escola operational totals are inverted', () => {
    const errors = [];
    const warnings = [];
    validateEscolas(
      [{ id_escola: 1, nome_escola: 'Escola A', alunos_previstos: 10, alunos_iniciaram: 12, alunos_finalizaram: 13 }],
      errors,
      warnings,
    );
    expect(errors.some((error) => error.includes('excede'))).toBe(true);
  });
});
