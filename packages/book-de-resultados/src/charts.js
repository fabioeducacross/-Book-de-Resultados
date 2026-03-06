'use strict';

/**
 * Charts — Book de Resultados
 *
 * Generates chart data structures consumed by the exporter when
 * rendering pages. This module does NOT produce image files; instead
 * it produces serializable chart descriptors that can be converted to
 * images by the exporter (e.g., using a canvas library or embedding
 * in SVG/HTML).
 *
 * Chart types:
 *   distribution  — Stacked bar for proficiency levels
 *   ranking       — Horizontal bar chart for school ranking
 *   indicator     — Single KPI card data
 */

const NIVEL_LABELS = {
  abaixo_do_basico: 'Abaixo do Básico',
  basico: 'Básico',
  adequado: 'Adequado',
  avancado: 'Avançado',
};

const NIVEL_COLORS = {
  abaixo_do_basico: '#D32F2F',
  basico: '#F57C00',
  adequado: '#388E3C',
  avancado: '#1565C0',
};

/**
 * Builds a distribution chart descriptor for a proficiency level breakdown.
 * @param {object} distribuicao - { abaixo_do_basico, basico, adequado, avancado, percentuais }
 * @param {string} [title]
 * @returns {DistributionChart}
 */
function buildDistributionChart(distribuicao, title = 'Distribuição de Proficiência') {
  const niveis = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];

  const series = niveis.map((nivel) => ({
    nivel,
    label: NIVEL_LABELS[nivel],
    color: NIVEL_COLORS[nivel],
    alunos: distribuicao[nivel] || 0,
    percentual: (distribuicao.percentuais || {})[nivel] || 0,
  }));

  return {
    type: 'distribution',
    title,
    series,
    total: distribuicao.total || 0,
  };
}

/**
 * Builds a ranking chart descriptor (horizontal bar chart).
 * @param {Array<{nome_escola: string, media: number, posicao: number}>} rankingRows
 * @param {string} [title]
 * @returns {RankingChart}
 */
function buildRankingChart(rankingRows, title = 'Ranking de Escolas') {
  const bars = rankingRows.map((row) => ({
    label: row.nome_escola,
    value: row.media,
    posicao: row.posicao,
    color: NIVEL_COLORS.adequado,
  }));

  return {
    type: 'ranking',
    title,
    bars,
    maxValue: bars.length > 0 ? Math.max(...bars.map((b) => b.value)) : 0,
  };
}

/**
 * Builds an indicator card descriptor.
 * @param {string} titulo
 * @param {string|number} valor
 * @param {string} [descricao]
 * @returns {IndicatorCard}
 */
function buildIndicatorCard(titulo, valor, descricao = '') {
  return {
    type: 'indicator',
    titulo,
    valor,
    descricao,
  };
}

/**
 * Generates all chart descriptors for a given page.
 * @param {object} page - Rendered page object
 * @returns {object[]} Array of chart descriptors for this page
 */
function generateChartsForPage(page) {
  const charts = [];
  const { section, data } = page;

  switch (section) {
    case 'visao_geral':
      charts.push(buildDistributionChart(data.distribuicao, 'Distribuição de Proficiência — Rede'));
      charts.push(buildIndicatorCard('Total de Escolas', data.totalEscolas));
      charts.push(buildIndicatorCard('Total de Estudantes', data.totalAlunos));
      charts.push(buildIndicatorCard('Participação Média', `${data.participacaoMedia}%`));
      charts.push(buildIndicatorCard('Média Geral', data.mediaGeral));
      break;

    case 'resultados_disciplina':
      charts.push(
        buildDistributionChart(data.distribuicao, `Distribuição de Proficiência — ${data.disciplina}`),
      );
      charts.push(buildIndicatorCard('Média da Rede', data.media));
      charts.push(buildIndicatorCard('Participação', `${data.participacao}%`));
      break;

    case 'ranking':
      charts.push(buildRankingChart(data.rows, `Ranking — ${data.disciplina}`));
      break;

    case 'escola':
      charts.push(buildDistributionChart(data.distribuicao, `Distribuição — ${data.nome_escola}`));
      charts.push(buildIndicatorCard('Média da Escola', data.media));
      charts.push(buildIndicatorCard('Média da Rede', data.mediaRede));
      charts.push(buildIndicatorCard('Participação', `${data.participacao}%`));
      charts.push(buildIndicatorCard('Alunos Avaliados', data.totalAlunos));
      break;

    case 'resultados_ano':
      charts.push(buildDistributionChart(data.distribuicao, `Distribuição — ${data.ano}`));
      charts.push(buildIndicatorCard('Média da Rede', data.mediaRede));
      break;

    default:
      break;
  }

  return charts;
}

module.exports = {
  buildDistributionChart,
  buildRankingChart,
  buildIndicatorCard,
  generateChartsForPage,
  NIVEL_LABELS,
  NIVEL_COLORS,
};
