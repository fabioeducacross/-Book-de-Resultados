'use strict';

const { DEFAULT_THEME } = require('./theme');

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
 *   distribution       — Stacked bar for proficiency levels
 *   ranking            — Horizontal bar chart for school ranking
 *   indicator          — Single KPI card data
 *   comparativo_chart  — Side-by-side school vs. network bar data
 */

const NIVEL_LABELS = {
  abaixo_do_basico: 'Abaixo do Básico',
  basico: 'Básico',
  adequado: 'Adequado',
  avancado: 'Avançado',
};

const NIVEL_COLORS = {
  abaixo_do_basico: (((DEFAULT_THEME || {}).colors || {}).proficiency || {}).abaixo_do_basico || '#969799',
  basico: (((DEFAULT_THEME || {}).colors || {}).proficiency || {}).basico || '#ED6300',
  adequado: (((DEFAULT_THEME || {}).colors || {}).proficiency || {}).adequado || '#FFB545',
  avancado: (((DEFAULT_THEME || {}).colors || {}).proficiency || {}).avancado || '#00A39E',
};

/**
 * Builds a distribution chart descriptor for a proficiency level breakdown.
 * @param {object} distribuicao - { abaixo_do_basico, basico, adequado, avancado, percentuais }
 * @param {string} [title]
 * @returns {DistributionChart}
 */
function buildDistributionChart(distribuicao, title = 'Distribuição de Proficiência', theme = DEFAULT_THEME) {
  const niveis = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
  const proficiencyColors = (theme && theme.colors && theme.colors.proficiency)
    ? theme.colors.proficiency
    : NIVEL_COLORS;

  const series = niveis.map((nivel) => ({
    nivel,
    label: NIVEL_LABELS[nivel],
    color: proficiencyColors[nivel] || NIVEL_COLORS[nivel],
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
function buildRankingChart(rankingRows, title = 'Ranking de Escolas', theme = DEFAULT_THEME) {
  const proficiencyColors = (theme && theme.colors && theme.colors.proficiency)
    ? theme.colors.proficiency
    : NIVEL_COLORS;
  const bars = rankingRows.map((row) => ({
    label: row.nome_escola,
    value: row.media,
    posicao: row.posicao,
    color: proficiencyColors.adequado || NIVEL_COLORS.adequado,
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

function buildRankingPositionIndicator(position) {
  const numeric = Number(position);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return buildIndicatorCard('Posição Geral', `${numeric}º`);
}

/**
 * Builds a comparativo chart descriptor (school vs network, side-by-side bars).
 * @param {object[]} comparativos - Array of comparativo rows (flat or nested format)
 * @param {string} [title]
 * @param {object} [theme] - Optional theme; uses NIVEL_COLORS fallback when absent
 * @returns {ComparativoChart}
 */
function buildComparativoChart(comparativos, title = 'Comparativo Escola vs. Rede', theme) {
  const profColors = (theme && theme.colors && theme.colors.proficiency) ? theme.colors.proficiency : NIVEL_COLORS;
  const deltaPositive = (theme && theme.colors && theme.colors.deltaPositive) ? theme.colors.deltaPositive : '#2E7D32';
  const deltaNegative = (theme && theme.colors && theme.colors.deltaNegative) ? theme.colors.deltaNegative : '#C62828';

  const pairs = (comparativos || []).map((comp) => {
    const escolaMedia =
      comp.escola != null && comp.escola.media != null ? comp.escola.media
        : comp.mediaEscola != null ? comp.mediaEscola : null;
    const redeMedia =
      comp.rede != null && comp.rede.media != null ? comp.rede.media
        : comp.mediaRede != null ? comp.mediaRede : null;
    const deltaMedia =
      comp.delta != null && comp.delta.media != null ? comp.delta.media
        : comp.deltaMedia != null ? comp.deltaMedia : null;

    return {
      label: comp.disciplina || '',
      escola: { value: escolaMedia, color: profColors.adequado || '#388E3C' },
      rede: { value: redeMedia, color: profColors.basico || '#F57C00' },
      delta: {
        value: deltaMedia,
        color: deltaMedia == null ? '#757575' : Number(deltaMedia) >= 0 ? deltaPositive : deltaNegative,
      },
    };
  });

  const allValues = pairs
    .flatMap((p) => [p.escola.value, p.rede.value])
    .filter((v) => v != null && Number.isFinite(Number(v)))
    .map(Number);

  return {
    type: 'comparativo_chart',
    title,
    pairs,
    maxValue: allValues.length > 0 ? Math.max(...allValues) : 0,
    minValue: allValues.length > 0 ? Math.min(...allValues) : 0,
  };
}

/**
 * Generates all chart descriptors for a given page.
 * @param {object} page - Rendered page object
 * @returns {object[]} Array of chart descriptors for this page
 */
function generateChartsForPage(page, theme = DEFAULT_THEME) {
  const charts = [];
  const { section, data } = page;

  switch (section) {
    case 'visao_geral':
      charts.push(buildDistributionChart(data.distribuicao, 'Distribuição de Proficiência — Rede', theme));
      charts.push(buildIndicatorCard('Total de Escolas', data.totalEscolas));
      charts.push(buildIndicatorCard('Total de Estudantes', data.totalAlunos));
      charts.push(buildIndicatorCard('Participação Média', `${data.participacaoMedia}%`));
      charts.push(buildIndicatorCard('Média Geral', data.mediaGeral));
      break;

    case 'resultados_disciplina':
      charts.push(
        buildDistributionChart(data.distribuicao, `Distribuição de Proficiência — ${data.disciplina}`, theme),
      );
      charts.push(buildIndicatorCard('Média da Rede', data.media));
      charts.push(buildIndicatorCard('Participação', `${data.participacao}%`));
      break;

    case 'ranking':
      charts.push(buildRankingChart(data.rows, `Ranking — ${data.disciplina}`, theme));
      break;

    case 'escola':
      charts.push(buildDistributionChart(data.distribuicao, `Distribuição — ${data.nome_escola}`, theme));
      if (data.rankingPosition) {
        charts.push(buildRankingPositionIndicator(data.rankingPosition));
      }
      if (data.operacional) {
        charts.push(buildIndicatorCard('Previstos', data.operacional.previstos ?? data.totalAlunos));
        charts.push(buildIndicatorCard('Iniciaram', data.operacional.iniciaram ?? data.totalAlunos));
        charts.push(buildIndicatorCard('Finalizaram', data.operacional.finalizaram ?? data.totalAlunos));
        charts.push(
          buildIndicatorCard(
            'Participação Total',
            `${data.operacional.participacaoTotal ?? data.participacao}%`,
          ),
        );
      } else {
        charts.push(buildIndicatorCard('Média da Escola', data.media));
        charts.push(buildIndicatorCard('Média da Rede', data.mediaRede));
        charts.push(buildIndicatorCard('Participação', `${data.participacao}%`));
        charts.push(buildIndicatorCard('Alunos Avaliados', data.totalAlunos));
      }
      break;

    case 'escola_disciplinas':
      if (data.rankingPosition) {
        charts.push(buildRankingPositionIndicator(data.rankingPosition));
      }
      if (data.participacaoPorDisciplina && data.participacaoPorDisciplina.length > 0) {
        charts.push(buildComparativoChart(data.participacaoPorDisciplina, `Comparativo — ${data.nome_escola}`, theme));
      }
      break;

    case 'resultados_ano':
      if (data.distribuicao) {
        charts.push(buildDistributionChart(data.distribuicao, `Distribuição — ${data.ano}`, theme));
      }
      if (data.escolas && data.escolas.length > 0) {
        charts.push(buildRankingChart(data.escolas, `Ranking de Escolas — ${data.ano}`, theme));
      }
      charts.push(buildIndicatorCard('Média da Rede', data.mediaRede));
      charts.push(buildIndicatorCard('Escolas com resultados', (data.escolas || []).length));
      if (data.participacaoMedia != null) {
        charts.push(buildIndicatorCard('Participação Média', `${data.participacaoMedia}%`));
      }
      break;

    case 'habilidades_disciplina':
      charts.push(buildIndicatorCard('Total de Habilidades', data.totalHabilidades || (data.rows || []).length));
      charts.push(buildIndicatorCard('Área / Disciplina', data.disciplina || '—'));
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
  buildRankingPositionIndicator,
  buildComparativoChart,
  generateChartsForPage,
  NIVEL_LABELS,
  NIVEL_COLORS,
};
