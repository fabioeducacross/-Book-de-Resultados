'use strict';

/**
 * Normalizer & Metrics Calculator — Book de Resultados
 *
 * Transforms raw parsed data into structured metrics used by the
 * renderer when building the book pages.
 *
 * Responsibilities:
 *  - Normalize string identifiers for safe comparison
 *  - Calculate network-wide (rede) aggregates
 *  - Calculate per-school indicators
 *  - Build school rankings
 *  - Paginate rankings when rule thresholds are exceeded
 */

const PAGINATION_THRESHOLD_SCHOOLS = 20;
const RANKING_MAX_PER_PAGE = 25;

/**
 * Normalizes and computes all metrics from raw parsed data.
 * @param {{ metadata: object, escolas: Array, resultados: Array, distribuicao: Array }} data
 * @returns {BookMetrics}
 */
function normalize(data) {
  const { metadata, escolas, resultados, distribuicao } = data;

  // Build a lookup map: id_escola (string) → escola object
  const escolaMap = buildEscolaMap(escolas);

  // Network-wide metrics
  const redeMetrics = computeRedeMetrics(resultados, distribuicao, escolas);

  // Per-school metrics
  const escolaMetrics = computeEscolaMetrics(escolaMap, resultados, distribuicao);

  // Rankings per discipline
  const rankings = buildRankings(escolaMetrics);

  // Paginated rankings (Rule 1 & Rule 2)
  const paginatedRankings = paginateRankings(rankings);

  // Disciplines list
  const disciplinas = [...new Set(resultados.map((r) => r.disciplina).filter(Boolean))];

  // Anos/séries list
  const anos = [...new Set(resultados.map((r) => String(r.ano)).filter(Boolean))];

  return {
    metadata,
    rede: redeMetrics,
    escolas: escolaMetrics,
    rankings,
    paginatedRankings,
    disciplinas,
    anos,
    totalEscolas: escolas.length,
  };
}

/**
 * Builds a map from id_escola (string) to escola object.
 * @param {Array} escolas
 * @returns {Map<string, object>}
 */
function buildEscolaMap(escolas) {
  const map = new Map();
  (escolas || []).forEach((e) => map.set(String(e.id_escola), e));
  return map;
}

/**
 * Computes network-wide aggregate metrics.
 * @param {Array} resultados
 * @param {Array} distribuicao
 * @param {Array} escolas
 * @returns {RedeMetrics}
 */
function computeRedeMetrics(resultados, distribuicao, escolas) {
  const totalEscolas = (escolas || []).length;

  // Mean participation across all results
  const participacaoValues = (resultados || []).map((r) => Number(r.participacao)).filter((v) => !isNaN(v));
  const participacaoMedia =
    participacaoValues.length > 0
      ? participacaoValues.reduce((a, b) => a + b, 0) / participacaoValues.length
      : 0;

  // Overall network mean
  const mediaValues = (resultados || []).map((r) => Number(r.media)).filter((v) => !isNaN(v));
  const mediaGeral =
    mediaValues.length > 0 ? mediaValues.reduce((a, b) => a + b, 0) / mediaValues.length : 0;

  // Total students (sum of distribuicao alunos)
  const totalAlunos = (distribuicao || []).reduce((sum, d) => sum + (Number(d.alunos) || 0), 0);

  // Distribution of proficiency levels (network-wide)
  const distribuicaoRede = computeDistribuicao(distribuicao);

  // Per-discipline means
  const mediasPorDisciplina = computeMediasPorDisciplina(resultados);

  return {
    totalEscolas,
    totalAlunos,
    participacaoMedia: round(participacaoMedia, 1),
    mediaGeral: round(mediaGeral, 1),
    distribuicao: distribuicaoRede,
    mediasPorDisciplina,
  };
}

/**
 * Computes per-school metrics.
 * @param {Map<string, object>} escolaMap
 * @param {Array} resultados
 * @param {Array} distribuicao
 * @returns {Array<EscolaMetrics>}
 */
function computeEscolaMetrics(escolaMap, resultados, distribuicao) {
  const escolaResultados = groupBy(resultados || [], (r) => String(r.id_escola));
  const escolaDistribuicao = groupBy(distribuicao || [], (d) => String(d.id_escola));

  const metrics = [];

  for (const [id, escola] of escolaMap.entries()) {
    const rows = escolaResultados.get(id) || [];
    const dist = escolaDistribuicao.get(id) || [];

    const mediaValues = rows.map((r) => Number(r.media)).filter((v) => !isNaN(v));
    const media = mediaValues.length > 0 ? mediaValues.reduce((a, b) => a + b, 0) / mediaValues.length : 0;

    const participacaoValues = rows.map((r) => Number(r.participacao)).filter((v) => !isNaN(v));
    const participacao =
      participacaoValues.length > 0
        ? participacaoValues.reduce((a, b) => a + b, 0) / participacaoValues.length
        : 0;

    const totalAlunos = dist.reduce((sum, d) => sum + (Number(d.alunos) || 0), 0);

    metrics.push({
      id_escola: id,
      nome_escola: escola.nome_escola,
      media: round(media, 1),
      participacao: round(participacao, 1),
      totalAlunos,
      distribuicao: computeDistribuicao(dist),
      resultadosPorAno: groupResultadosPorAno(rows),
    });
  }

  return metrics;
}

/**
 * Builds a ranked list per discipline, sorted descending by media.
 * @param {Array<EscolaMetrics>} escolaMetrics
 * @returns {Map<string, Array>} discipline → ranked escola list
 */
function buildRankings(escolaMetrics) {
  const byDisciplina = new Map();

  escolaMetrics.forEach((escola) => {
    (escola.resultadosPorAno || []).forEach((row) => {
      if (!row.disciplina) return;
      if (!byDisciplina.has(row.disciplina)) byDisciplina.set(row.disciplina, []);
      byDisciplina.get(row.disciplina).push({
        id_escola: escola.id_escola,
        nome_escola: escola.nome_escola,
        media: row.media,
        participacao: row.participacao,
      });
    });
  });

  // Sort each discipline by media descending and assign positions
  const rankings = {};
  for (const [disciplina, list] of byDisciplina.entries()) {
    const sorted = [...list].sort((a, b) => b.media - a.media);
    sorted.forEach((item, idx) => {
      item.posicao = idx + 1;
    });
    rankings[disciplina] = sorted;
  }

  return rankings;
}

/**
 * Paginates rankings according to rules:
 *   Rule 1: if escolas > 20, split into multiple pages
 *   Rule 2: if ranking > 25, show top 25 per page
 * @param {object} rankings
 * @returns {object} discipline → array of pages (each page is an array of rows)
 */
function paginateRankings(rankings) {
  const paginated = {};

  for (const [disciplina, list] of Object.entries(rankings)) {
    if (list.length <= PAGINATION_THRESHOLD_SCHOOLS) {
      paginated[disciplina] = [list];
    } else {
      const pages = [];
      for (let i = 0; i < list.length; i += RANKING_MAX_PER_PAGE) {
        pages.push(list.slice(i, i + RANKING_MAX_PER_PAGE));
      }
      paginated[disciplina] = pages;
    }
  }

  return paginated;
}

/**
 * Aggregates alunos per proficiency level.
 * @param {Array} dist - distribuicao rows
 * @returns {{ abaixo_do_basico: number, basico: number, adequado: number, avancado: number, percentuais: object }}
 */
function computeDistribuicao(dist) {
  const counts = { abaixo_do_basico: 0, basico: 0, adequado: 0, avancado: 0 };

  (dist || []).forEach((d) => {
    const nivel = d.nivel;
    if (nivel in counts) {
      counts[nivel] += Number(d.alunos) || 0;
    }
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const percentuais = {};
  for (const [nivel, count] of Object.entries(counts)) {
    percentuais[nivel] = total > 0 ? round((count / total) * 100, 1) : 0;
  }

  return { ...counts, total, percentuais };
}

/**
 * Groups resultados by ano/serie and calculates means.
 * @param {Array} rows
 * @returns {Array<{ano: string, disciplina: string, media: number, participacao: number}>}
 */
function groupResultadosPorAno(rows) {
  return (rows || []).map((r) => ({
    ano: String(r.ano),
    disciplina: r.disciplina,
    media: round(Number(r.media) || 0, 1),
    participacao: round(Number(r.participacao) || 0, 1),
  }));
}

/**
 * Computes per-discipline mean across all schools.
 * @param {Array} resultados
 * @returns {object} disciplina → { media: number, participacao: number }
 */
function computeMediasPorDisciplina(resultados) {
  const grouped = groupBy(resultados || [], (r) => r.disciplina);
  const result = {};

  for (const [disciplina, rows] of grouped.entries()) {
    const mediaValues = rows.map((r) => Number(r.media)).filter((v) => !isNaN(v));
    const participacaoValues = rows.map((r) => Number(r.participacao)).filter((v) => !isNaN(v));

    result[disciplina] = {
      media:
        mediaValues.length > 0 ? round(mediaValues.reduce((a, b) => a + b, 0) / mediaValues.length, 1) : 0,
      participacao:
        participacaoValues.length > 0
          ? round(participacaoValues.reduce((a, b) => a + b, 0) / participacaoValues.length, 1)
          : 0,
    };
  }

  return result;
}

/**
 * Groups an array by a key function.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => string} keyFn
 * @returns {Map<string, T[]>}
 */
function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/**
 * Rounds a number to a given number of decimal places.
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
function round(value, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

module.exports = {
  normalize,
  computeRedeMetrics,
  computeEscolaMetrics,
  buildRankings,
  paginateRankings,
  computeDistribuicao,
  round,
  PAGINATION_THRESHOLD_SCHOOLS,
  RANKING_MAX_PER_PAGE,
};
