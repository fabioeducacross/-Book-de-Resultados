'use strict';

/**
 * Tests for the Charts module — Book de Resultados
 */

const {
  buildDistributionChart,
  buildRankingChart,
  buildIndicatorCard,
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
        distribuicao: SAMPLE_DISTRIBUICAO,
        media: 255,
        mediaRede: 246,
        participacao: 90,
        totalAlunos: 80,
      },
    };
    const charts = generateChartsForPage(page);
    expect(charts.some((c) => c.type === 'distribution')).toBe(true);
    expect(charts.filter((c) => c.type === 'indicator').length).toBeGreaterThan(0);
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
});
