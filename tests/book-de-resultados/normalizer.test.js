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
  computeDistribuicaoPorDisciplina,
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

function makeCanoasData() {
  return {
    metadata: {
      municipio: 'Canoas',
      ano: '2025',
      ciclo: '2025-sem2',
      data: '2025-10-01',
      nome_rede: 'Rede Canoas',
      alunos_previstos: 100,
      alunos_iniciaram: 93,
      alunos_finalizaram: 80,
    },
    escolas: [
      {
        id_escola: '1',
        nome_escola: 'Escola Alpha',
        alunos_previstos: 60,
        alunos_iniciaram: 55,
        alunos_finalizaram: 50,
        participacao_total: 83.3,
      },
      {
        id_escola: '2',
        nome_escola: 'Escola Beta',
        alunos_previstos: 40,
        alunos_iniciaram: 38,
        alunos_finalizaram: 30,
        participacao_total: 75,
      },
    ],
    resultados: [
      { id_escola: '1', ano: 'Geral', disciplina: 'Matemática', media: 260, participacao: 90, participantes: 54 },
      { id_escola: '2', ano: 'Geral', disciplina: 'Matemática', media: 240, participacao: 70, participantes: 28 },
      {
        id_escola: '1',
        ano: 'Geral',
        disciplina: 'Língua Portuguesa',
        media: 250,
        participacao: 80,
        participantes: 48,
      },
      {
        id_escola: '2',
        ano: 'Geral',
        disciplina: 'Língua Portuguesa',
        media: 230,
        participacao: 60,
        participantes: 24,
      },
    ],
    distribuicao: [
      { id_escola: '1', disciplina: 'Matemática', nivel: 'adequado', alunos: 30 },
      { id_escola: '1', disciplina: 'Matemática', nivel: 'avancado', alunos: 24 },
      { id_escola: '2', disciplina: 'Matemática', nivel: 'basico', alunos: 20 },
      { id_escola: '2', disciplina: 'Matemática', nivel: 'adequado', alunos: 8 },
      { id_escola: '1', disciplina: 'Língua Portuguesa', nivel: 'basico', alunos: 18 },
      { id_escola: '1', disciplina: 'Língua Portuguesa', nivel: 'adequado', alunos: 30 },
      { id_escola: '2', disciplina: 'Língua Portuguesa', nivel: 'abaixo_do_basico', alunos: 10 },
      { id_escola: '2', disciplina: 'Língua Portuguesa', nivel: 'basico', alunos: 14 },
    ],
    habilidades: [
      {
        area_conhecimento: 'Língua Portuguesa',
        ano_escolar: '3º Ano',
        codigo_habilidade: 'LP3A1',
        tematica: 'Leitura',
        habilidade: 'Localizar informações explícitas em textos.',
        desempenho_percentual: 79.67,
      },
      {
        area_conhecimento: 'Matemática',
        ano_escolar: '5º Ano',
        codigo_habilidade: 'MA5A2',
        tematica: 'Números',
        habilidade: 'Resolver problemas com números naturais.',
        desempenho_percentual: 64.2,
      },
    ],
    source: {
      layout: 'canoas-avaliacao-digital',
      sheetMap: {
        proficiencias: 'Proficiências',
        habilidades: 'Habilidades',
      },
      trace: {
        escolas: 2,
        resultados: 4,
        distribuicao: 8,
        habilidades: 2,
      },
    },
  };
}

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

describe('computeDistribuicaoPorDisciplina()', () => {
  test('groups distribuicao by disciplina when provided', () => {
    const dist = [
      { disciplina: 'Matemática', nivel: 'adequado', alunos: 10 },
      { disciplina: 'Matemática', nivel: 'basico', alunos: 5 },
      { disciplina: 'Português', nivel: 'avancado', alunos: 3 },
    ];

    const result = computeDistribuicaoPorDisciplina(dist);
    expect(result.Matemática.total).toBe(15);
    expect(result.Português.total).toBe(3);
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

  test('uses escola totals to avoid double counting when distribuicao has disciplina breakdown', () => {
    const escolas = [{ id_escola: '1', nome_escola: 'Escola Alpha', alunos_finalizaram: 37 }];
    const resultados = [{ id_escola: '1', ano: 'Geral', disciplina: 'Matemática', media: 50, participacao: 90 }];
    const distribuicao = [
      { id_escola: '1', disciplina: 'Matemática', nivel: 'adequado', alunos: 20 },
      { id_escola: '1', disciplina: 'Português', nivel: 'adequado', alunos: 20 },
    ];

    const metrics = computeRedeMetrics(resultados, distribuicao, escolas);
    expect(metrics.totalAlunos).toBe(37);
    expect(metrics.distribuicaoPorDisciplina.Matemática.total).toBe(20);
    expect(metrics.distribuicaoPorDisciplina.Português.total).toBe(20);
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

  test('includes distribuicaoPorDisciplina when rows have disciplina', () => {
    const escolaMetrics = computeEscolaMetrics(
      makeEscolaMap([{ id_escola: '1', nome_escola: 'Escola Alpha' }]),
      [{ id_escola: '1', ano: 'Geral', disciplina: 'Matemática', media: 50, participacao: 90 }],
      [
        { id_escola: '1', disciplina: 'Matemática', nivel: 'adequado', alunos: 10 },
        { id_escola: '1', disciplina: 'Português', nivel: 'basico', alunos: 5 },
      ],
    );

    expect(escolaMetrics[0].distribuicaoPorDisciplina.Matemática.total).toBe(10);
    expect(escolaMetrics[0].distribuicaoPorDisciplina.Português.total).toBe(5);
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

  test('assigns overall rankingPosition to each escola', () => {
    const data = {
      metadata: { municipio: 'Canoas', ano: 2025, ciclo: 'sem1', data: '2025-01-01' },
      escolas: BASE_ESCOLAS,
      resultados: BASE_RESULTADOS,
      distribuicao: BASE_DISTRIBUICAO,
    };
    const metrics = normalize(data);
    const alpha = metrics.escolas.find((item) => item.id_escola === '1');
    const beta = metrics.escolas.find((item) => item.id_escola === '2');

    expect(alpha.rankingPosition).toBe(1);
    expect(beta.rankingPosition).toBe(2);
  });

  test('materializes the canonical v2 model without breaking the legacy shape', () => {
    const metrics = normalize(makeCanoasData());

    expect(metrics.modelVersion).toBe('2.0');
    expect(metrics.context).toMatchObject({
      municipio: 'Canoas',
      ciclo: '2025-sem2',
      layout: 'canoas-avaliacao-digital',
    });
    expect(metrics.entities.rede.nome).toBe('Rede Canoas');
    expect(metrics.entities.escolas).toHaveLength(2);
    expect(metrics.entities.habilidades).toHaveLength(2);
    expect(metrics.compatibility.bookMetricsV1.rede.mediaGeral).toBe(metrics.rede.mediaGeral);
    expect(metrics.compatibility.bookMetricsV1.escolas).toHaveLength(metrics.escolas.length);
  });

  test('builds canonical facts for participation, proficiency and skill performance', () => {
    const metrics = normalize(makeCanoasData());

    expect(metrics.facts.participacoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: { type: 'escola', id: '1' },
          disciplinaId: 'matematica',
          anoId: 'geral',
          taxaParticipacao: 90,
        }),
      ]),
    );

    expect(metrics.facts.proficiencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: { type: 'rede', id: metrics.context.redeId },
          disciplinaId: 'matematica',
          anoId: 'geral',
          media: 250,
        }),
      ]),
    );

    expect(metrics.facts.desempenhosHabilidade).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          habilidadeId: expect.stringContaining('LP3A1'.toLowerCase()),
          desempenhoPercentual: 79.67,
        }),
      ]),
    );
  });

  test('derives escola vs rede comparatives from canonical facts', () => {
    const metrics = normalize(makeCanoasData());
    const comparative = metrics.derived.comparativos.escolaVsRede.find(
      (item) => item.escolaId === '1' && item.disciplina === 'Matemática',
    );

    expect(comparative).toBeDefined();
    expect(comparative.escola.media).toBe(260);
    expect(comparative.rede.media).toBe(250);
    expect(comparative.escola.taxaParticipacao).toBe(90);
    expect(comparative.delta.media).toBe(10);
    expect(comparative.delta.taxaParticipacao).toBe(10);
  });
});
