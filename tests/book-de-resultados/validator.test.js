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
} = require('../../packages/book-de-resultados/src/validator');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeValidData() {
  return {
    metadata: { municipio: 'Canoas', ano: 2025, ciclo: '2025-sem1', data: '2025-06-01' },
    escolas: [
      { id_escola: 1, nome_escola: 'Escola A' },
      { id_escola: 2, nome_escola: 'Escola B' },
    ],
    resultados: [
      { id_escola: 1, ano: '5', disciplina: 'Matemática', media: 250.5, participacao: 90 },
      { id_escola: 2, ano: '5', disciplina: 'Matemática', media: 235.0, participacao: 85 },
    ],
    distribuicao: [
      { id_escola: 1, nivel: 'adequado', alunos: 20 },
      { id_escola: 1, nivel: 'avancado', alunos: 10 },
      { id_escola: 2, nivel: 'basico', alunos: 15 },
      { id_escola: 2, nivel: 'abaixo_do_basico', alunos: 5 },
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

  test('passes with valid resultados', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [{ id_escola: 1, ano: '5', disciplina: 'Mat', media: 250, participacao: 90 }],
      escolaIds,
      errors,
      warnings,
    );
    expect(errors).toHaveLength(0);
  });

  test('errors on empty array', () => {
    const errors = [];
    const warnings = [];
    validateResultados([], escolaIds, errors, warnings);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('errors when media is negative', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [{ id_escola: 1, ano: '5', disciplina: 'Mat', media: -10, participacao: 90 }],
      escolaIds,
      errors,
      warnings,
    );
    expect(errors.some((e) => e.includes('"media"'))).toBe(true);
  });

  test('errors when participacao exceeds 100', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [{ id_escola: 1, ano: '5', disciplina: 'Mat', media: 250, participacao: 110 }],
      escolaIds,
      errors,
      warnings,
    );
    expect(errors.some((e) => e.includes('"participacao"'))).toBe(true);
  });

  test('warns when id_escola not found in escolas', () => {
    const errors = [];
    const warnings = [];
    validateResultados(
      [{ id_escola: 999, ano: '5', disciplina: 'Mat', media: 250, participacao: 80 }],
      escolaIds,
      errors,
      warnings,
    );
    expect(warnings.some((w) => w.includes('"999"'))).toBe(true);
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
