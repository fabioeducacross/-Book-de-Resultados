'use strict';

/**
 * Tests for the Charts module — Book de Resultados
 */

const {
  buildDistributionChart,
  buildRankingChart,
  buildIndicatorCard,
  buildRankingPositionIndicator,
  buildComparativoChart,
  generateChartsForPage,
  NIVEL_LABELS,
  NIVEL_COLORS,
} = require('../../packages/book-de-resultados/src/charts');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_DISTRIBUICAO = {
  abaixo_do_basico: 5,
  basico: 15,
  adequado: 40,
  avancado: 20,
  total: 80,
  percentuais: { abaixo_do_basico: 6.3, basico: 18.8, adequado: 50.0, avancado: 25.0 },
};

const SAMPLE_RANKING = [
  { nome_escola: 'Escola A', media: 280, posicao: 1 },
  { nome_escola: 'Escola B', media: 260, posicao: 2 },
  { nome_escola: 'Escola C', media: 240, posicao: 3 },
];

// ─── buildDistributionChart() ─────────────────────────────────────────────────

describe('buildDistributionChart()', () => {
  test('returns type "distribution"', () => {
    const chart = buildDistributionChart(SAMPLE_DISTRIBUICAO);
    expect(chart.type).toBe('distribution');
  });

  test('includes all 4 proficiency levels in series', () => {
    const chart = buildDistributionChart(SAMPLE_DISTRIBUICAO);
    expect(chart.series).toHaveLength(4);
    const niveis = chart.series.map((s) => s.nivel);
    expect(niveis).toContain('abaixo_do_basico');
    expect(niveis).toContain('basico');
    expect(niveis).toContain('adequado');
    expect(niveis).toContain('avancado');
  });

  test('each series item has label, color, alunos, and percentual', () => {
    const chart = buildDistributionChart(SAMPLE_DISTRIBUICAO);
    chart.series.forEach((item) => {
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('color');
      expect(item).toHaveProperty('alunos');
      expect(item).toHaveProperty('percentual');
    });
  });

  test('uses NIVEL_LABELS for display labels', () => {
    const chart = buildDistributionChart(SAMPLE_DISTRIBUICAO);
    chart.series.forEach((item) => {
      expect(item.label).toBe(NIVEL_LABELS[item.nivel]);
    });
  });

  test('uses NIVEL_COLORS for series colors', () => {
    const chart = buildDistributionChart(SAMPLE_DISTRIBUICAO);
    chart.series.forEach((item) => {
      expect(item.color).toBe(NIVEL_COLORS[item.nivel]);
    });
  });

  test('uses provided title', () => {
    const chart = buildDistributionChart(SAMPLE_DISTRIBUICAO, 'Custom Title');
    expect(chart.title).toBe('Custom Title');
  });

  test('total matches distribuicao.total', () => {
    const chart = buildDistributionChart(SAMPLE_DISTRIBUICAO);
    expect(chart.total).toBe(80);
  });
});

// ─── buildRankingChart() ──────────────────────────────────────────────────────

describe('buildRankingChart()', () => {
  test('returns type "ranking"', () => {
    const chart = buildRankingChart(SAMPLE_RANKING);
    expect(chart.type).toBe('ranking');
  });

  test('each bar has label, value, and posicao', () => {
    const chart = buildRankingChart(SAMPLE_RANKING);
    chart.bars.forEach((bar) => {
      expect(bar).toHaveProperty('label');
      expect(bar).toHaveProperty('value');
      expect(bar).toHaveProperty('posicao');
    });
  });

  test('maxValue is the highest media', () => {
    const chart = buildRankingChart(SAMPLE_RANKING);
    expect(chart.maxValue).toBe(280);
  });

  test('handles empty ranking gracefully', () => {
    const chart = buildRankingChart([]);
    expect(chart.bars).toHaveLength(0);
    expect(chart.maxValue).toBe(0);
  });
});

// ─── buildIndicatorCard() ─────────────────────────────────────────────────────

describe('buildIndicatorCard()', () => {
  test('returns type "indicator"', () => {
    const card = buildIndicatorCard('Total', 42);
    expect(card.type).toBe('indicator');
  });

  test('stores titulo and valor', () => {
    const card = buildIndicatorCard('Média Geral', 256.5, 'pontos');
    expect(card.titulo).toBe('Média Geral');
    expect(card.valor).toBe(256.5);
    expect(card.descricao).toBe('pontos');
  });

  test('descricao defaults to empty string', () => {
    const card = buildIndicatorCard('Total', 10);
    expect(card.descricao).toBe('');
  });
});

describe('buildRankingPositionIndicator()', () => {
  test('returns a ranking indicator card when the position is valid', () => {
    const card = buildRankingPositionIndicator(3);
    expect(card).toMatchObject({
      type: 'indicator',
      titulo: 'Posição Geral',
      valor: '3º',
    });
  });

  test('returns null when the position is invalid', () => {
    expect(buildRankingPositionIndicator(0)).toBeNull();
  });
});

// ─── generateChartsForPage() ──────────────────────────────────────────────────

describe('generateChartsForPage()', () => {
  test('visao_geral: returns distribution + 4 indicator cards', () => {
    const page = {
      section: 'visao_geral',
      data: {
        distribuicao: SAMPLE_DISTRIBUICAO,
        totalEscolas: 10,
        totalAlunos: 500,
        participacaoMedia: 88.5,
        mediaGeral: 252.3,
        mediasPorDisciplina: {},
      },
    };
    const charts = generateChartsForPage(page);
    expect(charts.some((c) => c.type === 'distribution')).toBe(true);
    const indicators = charts.filter((c) => c.type === 'indicator');
    expect(indicators.length).toBe(4);
  });

  test('ranking: returns a ranking chart', () => {
    const page = {
      section: 'ranking',
      data: { disciplina: 'Matemática', rows: SAMPLE_RANKING },
    };
    const charts = generateChartsForPage(page);
    expect(charts).toHaveLength(1);
    expect(charts[0].type).toBe('ranking');
  });

  test('escola: returns distribution + indicator cards', () => {
    const page = {
      section: 'escola',
      data: {
        nome_escola: 'Escola A',
        rankingPosition: 2,
        distribuicao: SAMPLE_DISTRIBUICAO,
        media: 255,
        mediaRede: 246,
        participacao: 90,
        totalAlunos: 80,
        operacional: {
          previstos: 82,
          iniciaram: 80,
          finalizaram: 78,
          participacaoTotal: 95.1,
        },
      },
    };
    const charts = generateChartsForPage(page);
    expect(charts.some((c) => c.type === 'distribution')).toBe(true);
    expect(charts.filter((c) => c.type === 'indicator').length).toBeGreaterThan(0);
    expect(charts.some((c) => c.titulo === 'Posição Geral')).toBe(true);
  });

  test('escola: prioritizes operational indicators when available', () => {
    const page = {
      section: 'escola',
      data: {
        nome_escola: 'Escola A',
        rankingPosition: 2,
        distribuicao: SAMPLE_DISTRIBUICAO,
        media: 255,
        mediaRede: 246,
        participacao: 90,
        totalAlunos: 80,
        operacional: {
          previstos: 82,
          iniciaram: 80,
          finalizaram: 78,
          participacaoTotal: 95.1,
        },
      },
    };

    const charts = generateChartsForPage(page);
    const indicatorTitles = charts.filter((chart) => chart.type === 'indicator').map((chart) => chart.titulo);

    expect(indicatorTitles).toEqual(
      expect.arrayContaining(['Posição Geral', 'Previstos', 'Iniciaram', 'Finalizaram', 'Participação Total']),
    );
  });

  test('resultados_ano: returns ranking, optional distribution and year indicators', () => {
    const page = {
      section: 'resultados_ano',
      data: {
        ano: '5',
        mediaRede: 226.3,
        participacaoMedia: 83.3,
        distribuicao: SAMPLE_DISTRIBUICAO,
        escolas: [
          { nome_escola: 'Escola A', media: 257.5, participacao: 91.5, posicao: 1 },
          { nome_escola: 'Escola B', media: 195, participacao: 75, posicao: 2 },
        ],
      },
    };

    const charts = generateChartsForPage(page);

    expect(charts.some((chart) => chart.type === 'distribution')).toBe(true);
    expect(charts.some((chart) => chart.type === 'ranking')).toBe(true);
    expect(charts.filter((chart) => chart.type === 'indicator').map((chart) => chart.titulo)).toEqual(
      expect.arrayContaining(['Média da Rede', 'Escolas com resultados', 'Participação Média']),
    );
  });

  test('returns empty array for capa page', () => {
    const page = { section: 'capa', data: {} };
    const charts = generateChartsForPage(page);
    expect(charts).toHaveLength(0);
  });

  test('returns empty array for sumario page', () => {
    const page = { section: 'sumario', data: {} };
    const charts = generateChartsForPage(page);
    expect(charts).toHaveLength(0);
  });

  test('escola_disciplinas: returns a comparativo_chart when participacaoPorDisciplina is present', () => {
    const page = {
      section: 'escola_disciplinas',
      data: {
        nome_escola: 'Escola A',
        rankingPosition: 1,
        participacaoPorDisciplina: [
          { disciplina: 'Matemática', mediaEscola: 260, mediaRede: 250, deltaMedia: 10, participacaoEscola: 92, participacaoRede: 90 },
        ],
      },
    };
    const charts = generateChartsForPage(page);
    expect(charts).toHaveLength(2);
    expect(charts.some((chart) => chart.type === 'comparativo_chart')).toBe(true);
    expect(charts.some((chart) => chart.titulo === 'Posição Geral')).toBe(true);
  });

  test('escola_disciplinas: returns empty array when participacaoPorDisciplina is empty', () => {
    const page = {
      section: 'escola_disciplinas',
      data: { nome_escola: 'Escola A', participacaoPorDisciplina: [] },
    };
    const charts = generateChartsForPage(page);
    expect(charts).toHaveLength(0);
  });

  test('habilidades_disciplina: returns 2 indicator cards', () => {
    const page = {
      section: 'habilidades_disciplina',
      data: { disciplina: 'Matemática', rows: [], totalHabilidades: 12 },
    };
    const charts = generateChartsForPage(page);
    const indicators = charts.filter((c) => c.type === 'indicator');
    expect(indicators.length).toBe(2);
  });
});

// ─── buildComparativoChart() ──────────────────────────────────────────────────

describe('buildComparativoChart()', () => {
  const SAMPLE = [
    {
      disciplina: 'Matemática',
      escola: { media: 260, taxaParticipacao: 92 },
      rede: { media: 250, taxaParticipacao: 90 },
      delta: { media: 10 },
    },
    {
      disciplina: 'Português',
      escola: { media: 230, taxaParticipacao: 88 },
      rede: { media: 242, taxaParticipacao: 90 },
      delta: { media: -12 },
    },
  ];

  test('returns type "comparativo_chart"', () => {
    const chart = buildComparativoChart(SAMPLE);
    expect(chart.type).toBe('comparativo_chart');
  });

  test('pairs count matches input', () => {
    const chart = buildComparativoChart(SAMPLE);
    expect(chart.pairs).toHaveLength(2);
  });

  test('each pair has label, escola, rede, delta', () => {
    const chart = buildComparativoChart(SAMPLE);
    chart.pairs.forEach((pair) => {
      expect(pair).toHaveProperty('label');
      expect(pair).toHaveProperty('escola');
      expect(pair).toHaveProperty('rede');
      expect(pair).toHaveProperty('delta');
    });
  });

  test('escola.value and rede.value are populated', () => {
    const chart = buildComparativoChart(SAMPLE);
    const mat = chart.pairs.find((p) => p.label === 'Matemática');
    expect(mat.escola.value).toBe(260);
    expect(mat.rede.value).toBe(250);
  });

  test('maxValue is the highest media across escola and rede', () => {
    const chart = buildComparativoChart(SAMPLE);
    expect(chart.maxValue).toBe(260);
  });

  test('minValue is the lowest media', () => {
    const chart = buildComparativoChart(SAMPLE);
    expect(chart.minValue).toBe(230);
  });

  test('positive delta gets a green-family color', () => {
    const chart = buildComparativoChart(SAMPLE);
    const mat = chart.pairs.find((p) => p.label === 'Matemática');
    // deltaPositive default is #2E7D32
    expect(mat.delta.color).not.toBe('#757575'); // not neutral
    expect(mat.delta.color).not.toMatch(/c62828/i); // not negative
  });

  test('negative delta gets a red-family color', () => {
    const chart = buildComparativoChart(SAMPLE);
    const port = chart.pairs.find((p) => p.label === 'Português');
    expect(port.delta.color).not.toBe('#757575'); // not neutral
    expect(port.delta.color).not.toMatch(/2e7d32/i); // not positive
  });

  test('handles empty input gracefully', () => {
    const chart = buildComparativoChart([]);
    expect(chart.pairs).toHaveLength(0);
    expect(chart.maxValue).toBe(0);
    expect(chart.minValue).toBe(0);
  });

  test('uses custom title', () => {
    const chart = buildComparativoChart(SAMPLE, 'Custom Comparativo');
    expect(chart.title).toBe('Custom Comparativo');
  });

  test('also reads flat format (mediaEscola / mediaRede)', () => {
    const flat = [
      { disciplina: 'Matemática', mediaEscola: 260, mediaRede: 250, deltaMedia: 10 },
    ];
    const chart = buildComparativoChart(flat);
    expect(chart.pairs[0].escola.value).toBe(260);
    expect(chart.pairs[0].rede.value).toBe(250);
  });
});
