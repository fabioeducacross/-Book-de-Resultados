'use strict';

/**
 * Tests for the Normalizer module — Book de Resultados
 */

const {
  normalize,
  computeRedeMetrics,
  computeEscolaMetrics,
  buildRankings,
  paginateRankings,
  computeDistribuicao,
  round,
  PAGINATION_THRESHOLD_SCHOOLS,
  RANKING_MAX_PER_PAGE,
} = require('../../packages/book-de-resultados/src/normalizer');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEscolaMap(escolas) {
  const map = new Map();
  escolas.forEach((e) => map.set(String(e.id_escola), e));
  return map;
}

const BASE_ESCOLAS = [
  { id_escola: '1', nome_escola: 'Escola Alpha' },
  { id_escola: '2', nome_escola: 'Escola Beta' },
];

const BASE_RESULTADOS = [
  { id_escola: '1', ano: '5', disciplina: 'Matemática', media: 260, participacao: 92 },
  { id_escola: '2', ano: '5', disciplina: 'Matemática', media: 240, participacao: 88 },
  { id_escola: '1', ano: '5', disciplina: 'Português', media: 255, participacao: 91 },
  { id_escola: '2', ano: '5', disciplina: 'Português', media: 230, participacao: 85 },
];

const BASE_DISTRIBUICAO = [
  { id_escola: '1', nivel: 'avancado', alunos: 10 },
  { id_escola: '1', nivel: 'adequado', alunos: 20 },
  { id_escola: '1', nivel: 'basico', alunos: 5 },
  { id_escola: '1', nivel: 'abaixo_do_basico', alunos: 2 },
  { id_escola: '2', nivel: 'adequado', alunos: 15 },
  { id_escola: '2', nivel: 'basico', alunos: 12 },
  { id_escola: '2', nivel: 'avancado', alunos: 3 },
  { id_escola: '2', nivel: 'abaixo_do_basico', alunos: 6 },
];

// ─── round() ──────────────────────────────────────────────────────────────────

describe('round()', () => {
  test('rounds to 1 decimal place by default', () => {
    expect(round(1.234)).toBe(1.2);
    expect(round(1.25)).toBe(1.3);
  });

  test('handles zero', () => {
    expect(round(0)).toBe(0);
  });

  test('rounds with 2 decimals', () => {
    expect(round(1.2345, 2)).toBe(1.23);
  });
});

// ─── computeDistribuicao() ────────────────────────────────────────────────────

describe('computeDistribuicao()', () => {
  test('counts alunos per level', () => {
    const dist = [
      { nivel: 'adequado', alunos: 10 },
      { nivel: 'avancado', alunos: 5 },
      { nivel: 'basico', alunos: 3 },
      { nivel: 'abaixo_do_basico', alunos: 2 },
    ];
    const result = computeDistribuicao(dist);
    expect(result.adequado).toBe(10);
    expect(result.avancado).toBe(5);
    expect(result.basico).toBe(3);
    expect(result.abaixo_do_basico).toBe(2);
    expect(result.total).toBe(20);
  });

  test('computes percentuais correctly', () => {
    const dist = [
      { nivel: 'adequado', alunos: 50 },
      { nivel: 'basico', alunos: 50 },
    ];
    const result = computeDistribuicao(dist);
    expect(result.percentuais.adequado).toBe(50);
    expect(result.percentuais.basico).toBe(50);
  });

  test('handles empty distribuicao', () => {
    const result = computeDistribuicao([]);
    expect(result.total).toBe(0);
    expect(result.percentuais.adequado).toBe(0);
  });

  test('handles null gracefully', () => {
    const result = computeDistribuicao(null);
    expect(result.total).toBe(0);
  });
});

// ─── computeRedeMetrics() ─────────────────────────────────────────────────────

describe('computeRedeMetrics()', () => {
  test('computes mediaGeral as mean of all medias', () => {
    const metrics = computeRedeMetrics(BASE_RESULTADOS, BASE_DISTRIBUICAO, BASE_ESCOLAS);
    const expected = (260 + 240 + 255 + 230) / 4;
    expect(metrics.mediaGeral).toBe(round(expected));
  });

  test('computes totalAlunos as sum of all alunos', () => {
    const metrics = computeRedeMetrics(BASE_RESULTADOS, BASE_DISTRIBUICAO, BASE_ESCOLAS);
    const expected = 10 + 20 + 5 + 2 + 15 + 12 + 3 + 6;
    expect(metrics.totalAlunos).toBe(expected);
  });

  test('computes participacaoMedia correctly', () => {
    const metrics = computeRedeMetrics(BASE_RESULTADOS, BASE_DISTRIBUICAO, BASE_ESCOLAS);
    const expected = (92 + 88 + 91 + 85) / 4;
    expect(metrics.participacaoMedia).toBe(round(expected));
  });

  test('returns totalEscolas from escolas array length', () => {
    const metrics = computeRedeMetrics(BASE_RESULTADOS, BASE_DISTRIBUICAO, BASE_ESCOLAS);
    expect(metrics.totalEscolas).toBe(2);
  });

  test('handles empty inputs gracefully', () => {
    const metrics = computeRedeMetrics([], [], []);
    expect(metrics.mediaGeral).toBe(0);
    expect(metrics.totalAlunos).toBe(0);
  });
});

// ─── computeEscolaMetrics() ───────────────────────────────────────────────────

describe('computeEscolaMetrics()', () => {
  const escolaMap = makeEscolaMap(BASE_ESCOLAS);

  test('returns one entry per escola', () => {
    const metrics = computeEscolaMetrics(escolaMap, BASE_RESULTADOS, BASE_DISTRIBUICAO);
    expect(metrics).toHaveLength(2);
  });

  test('includes nome_escola and media', () => {
    const metrics = computeEscolaMetrics(escolaMap, BASE_RESULTADOS, BASE_DISTRIBUICAO);
    const alpha = metrics.find((m) => m.id_escola === '1');
    expect(alpha).toBeDefined();
    expect(alpha.nome_escola).toBe('Escola Alpha');
    expect(alpha.media).toBeGreaterThan(0);
  });

  test('computes totalAlunos per escola', () => {
    const metrics = computeEscolaMetrics(escolaMap, BASE_RESULTADOS, BASE_DISTRIBUICAO);
    const alpha = metrics.find((m) => m.id_escola === '1');
    expect(alpha.totalAlunos).toBe(10 + 20 + 5 + 2);
  });
});

// ─── buildRankings() ──────────────────────────────────────────────────────────

describe('buildRankings()', () => {
  test('returns rankings indexed by discipline', () => {
    const escolaMetrics = computeEscolaMetrics(makeEscolaMap(BASE_ESCOLAS), BASE_RESULTADOS, BASE_DISTRIBUICAO);
    const rankings = buildRankings(escolaMetrics);
    expect(rankings).toHaveProperty('Matemática');
    expect(rankings).toHaveProperty('Português');
  });

  test('sorts schools by media descending', () => {
    const escolaMetrics = computeEscolaMetrics(makeEscolaMap(BASE_ESCOLAS), BASE_RESULTADOS, BASE_DISTRIBUICAO);
    const rankings = buildRankings(escolaMetrics);
    const mat = rankings['Matemática'];
    expect(mat[0].media).toBeGreaterThanOrEqual(mat[1].media);
  });

  test('assigns posicao starting from 1', () => {
    const escolaMetrics = computeEscolaMetrics(makeEscolaMap(BASE_ESCOLAS), BASE_RESULTADOS, BASE_DISTRIBUICAO);
    const rankings = buildRankings(escolaMetrics);
    const mat = rankings['Matemática'];
    expect(mat[0].posicao).toBe(1);
    expect(mat[1].posicao).toBe(2);
  });
});

// ─── paginateRankings() ───────────────────────────────────────────────────────

describe('paginateRankings()', () => {
  test(`does not paginate when schools <= ${PAGINATION_THRESHOLD_SCHOOLS}`, () => {
    const rankings = {
      Matemática: Array.from({ length: 10 }, (_, i) => ({ nome_escola: `E${i}`, media: 250 - i, posicao: i + 1 })),
    };
    const paginated = paginateRankings(rankings);
    expect(paginated.Matemática).toHaveLength(1);
    expect(paginated.Matemática[0]).toHaveLength(10);
  });

  test(`paginates into chunks of ${RANKING_MAX_PER_PAGE} when schools > ${PAGINATION_THRESHOLD_SCHOOLS}`, () => {
    const rankings = {
      Matemática: Array.from({ length: 30 }, (_, i) => ({ nome_escola: `E${i}`, media: 300 - i, posicao: i + 1 })),
    };
    const paginated = paginateRankings(rankings);
    expect(paginated.Matemática).toHaveLength(2);
    expect(paginated.Matemática[0]).toHaveLength(RANKING_MAX_PER_PAGE);
    expect(paginated.Matemática[1]).toHaveLength(5); // 30 - 25
  });
});

// ─── normalize() ─────────────────────────────────────────────────────────────

describe('normalize()', () => {
  test('returns all expected top-level keys', () => {
    const data = {
      metadata: { municipio: 'Canoas', ano: 2025, ciclo: 'sem1', data: '2025-01-01' },
      escolas: BASE_ESCOLAS,
      resultados: BASE_RESULTADOS,
      distribuicao: BASE_DISTRIBUICAO,
    };
    const metrics = normalize(data);
    expect(metrics).toHaveProperty('metadata');
    expect(metrics).toHaveProperty('rede');
    expect(metrics).toHaveProperty('escolas');
    expect(metrics).toHaveProperty('rankings');
    expect(metrics).toHaveProperty('paginatedRankings');
    expect(metrics).toHaveProperty('disciplinas');
    expect(metrics).toHaveProperty('anos');
    expect(metrics).toHaveProperty('totalEscolas');
  });

  test('disciplinas list contains all unique disciplines', () => {
    const data = {
      metadata: { municipio: 'Canoas', ano: 2025, ciclo: 'sem1', data: '2025-01-01' },
      escolas: BASE_ESCOLAS,
      resultados: BASE_RESULTADOS,
      distribuicao: BASE_DISTRIBUICAO,
    };
    const metrics = normalize(data);
    expect(metrics.disciplinas).toContain('Matemática');
    expect(metrics.disciplinas).toContain('Português');
  });
});
