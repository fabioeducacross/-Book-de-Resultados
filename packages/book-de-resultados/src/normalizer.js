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
  const {
    metadata = {},
    escolas = [],
    resultados = [],
    distribuicao = [],
    habilidades = [],
    source = { layout: 'unknown' },
  } = data || {};

  // Build a lookup map: id_escola (string) → escola object
  const escolaMap = buildEscolaMap(escolas);

  // Network-wide metrics
  const redeMetrics = computeRedeMetrics(resultados, distribuicao, escolas);

  // Per-school metrics
  const escolaMetrics = computeEscolaMetrics(escolaMap, resultados, distribuicao);
  assignOverallRankingPositions(escolaMetrics);

  // Rankings per discipline
  const rankings = buildRankings(escolaMetrics);

  // Paginated rankings (Rule 1 & Rule 2)
  const paginatedRankings = paginateRankings(rankings);

  // Disciplines list
  const disciplinas = [...new Set(resultados.map((r) => r.disciplina).filter(Boolean))];

  // Anos/séries list
  const anos = [...new Set(resultados.map((r) => String(r.ano)).filter(Boolean))];

  const legacyView = {
    metadata,
    rede: redeMetrics,
    escolas: escolaMetrics,
    rankings,
    paginatedRankings,
    disciplinas,
    anos,
    totalEscolas: escolas.length,
  };

  const context = buildAssessmentContext(metadata, source);
  const entities = buildCanonicalEntities({ metadata, escolas, resultados, habilidades }, context);
  const facts = buildCanonicalFacts(
    { metadata, escolas, resultados, distribuicao, habilidades },
    entities,
    context,
  );
  const derived = buildDerivedModel({ entities, facts, rankings, paginatedRankings });

  return {
    ...legacyView,
    modelVersion: '2.0',
    source: normalizeSource(source),
    context,
    entities,
    facts,
    derived,
    compatibility: {
      bookMetricsV1: legacyView,
    },
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

  // Total students from escola metadata when available; fallback to distribuicao rows.
  const totalAlunos = computeTotalAlunos(escolas, distribuicao);

  // Distribution of proficiency levels (network-wide)
  const distribuicaoRede = computeDistribuicao(distribuicao);
  const distribuicaoPorDisciplina = computeDistribuicaoPorDisciplina(distribuicao);

  // Per-discipline means
  const mediasPorDisciplina = computeMediasPorDisciplina(resultados);

  return {
    totalEscolas,
    totalAlunos,
    participacaoMedia: round(participacaoMedia, 1),
    mediaGeral: round(mediaGeral, 1),
    distribuicao: distribuicaoRede,
    distribuicaoPorDisciplina,
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
      distribuicaoPorDisciplina: computeDistribuicaoPorDisciplina(dist),
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

function computeDistribuicaoPorDisciplina(dist) {
  const grouped = groupBy(
    (dist || []).filter((row) => row && row.disciplina),
    (row) => row.disciplina,
  );
  const result = {};

  for (const [disciplina, rows] of grouped.entries()) {
    result[disciplina] = computeDistribuicao(rows);
  }

  return result;
}

function computeTotalAlunos(escolas, distribuicao) {
  const escolaTotals = (escolas || [])
    .map((escola) => Number(escola.alunos_finalizaram ?? escola.totalAlunos))
    .filter((value) => !isNaN(value) && value > 0);

  if (escolaTotals.length > 0) {
    return escolaTotals.reduce((sum, value) => sum + value, 0);
  }

  const hasDisciplineBreakdown = (distribuicao || []).some((row) => row && row.disciplina);
  if (hasDisciplineBreakdown) {
    const porDisciplina = computeDistribuicaoPorDisciplina(distribuicao);
    const primeiraDisciplina = Object.values(porDisciplina)[0];
    return primeiraDisciplina ? primeiraDisciplina.total : 0;
  }

  return (distribuicao || []).reduce((sum, d) => sum + (Number(d.alunos) || 0), 0);
}

function assignOverallRankingPositions(escolaMetrics) {
  const ordered = [...(escolaMetrics || [])].sort((a, b) => b.media - a.media);
  ordered.forEach((item, index) => {
    item.rankingPosition = index + 1;
  });
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

function normalizeSource(source) {
  return {
    layout: source && source.layout ? source.layout : 'unknown',
    sheetMap: source && source.sheetMap ? source.sheetMap : {},
    trace: source && source.trace ? source.trace : {},
  };
}

function buildAssessmentContext(metadata, source) {
  const municipio = normalizeText(metadata.municipio) || normalizeText(metadata.nome_rede) || 'Município';
  const anoLetivo = normalizeText(metadata.ano);
  const ciclo = normalizeText(metadata.ciclo);
  const redeLabel = normalizeText(metadata.nome_rede) || municipio || 'Rede Principal';

  return {
    assessmentId: slugify([municipio, anoLetivo, ciclo].filter(Boolean).join('-')) || 'book-de-resultados',
    redeId: `rede_${slugify(redeLabel) || 'principal'}`,
    municipio,
    anoLetivo,
    ciclo,
    dataAvaliacao: normalizeText(metadata.data),
    layout: source && source.layout ? source.layout : 'unknown',
  };
}

function buildCanonicalEntities(raw, context) {
  const { metadata, escolas, resultados, habilidades } = raw;
  const areaMap = new Map();
  const disciplinaMap = new Map();
  const anoMap = new Map();
  const areas = [];
  const disciplinas = [];
  const anos = [];

  const ensureArea = (label) => {
    const nome = normalizeText(label);
    if (!nome) return null;

    const key = normalizeDimensionKey(nome);
    if (areaMap.has(key)) {
      return areaMap.get(key);
    }

    const area = {
      id: slugify(nome) || `area_${areas.length + 1}`,
      nome,
    };
    areaMap.set(key, area);
    areas.push(area);
    return area;
  };

  const ensureDisciplina = (label) => {
    const nome = normalizeText(label);
    if (!nome) return null;

    const key = normalizeDimensionKey(nome);
    if (disciplinaMap.has(key)) {
      return disciplinaMap.get(key);
    }

    const area = ensureArea(nome);
    const disciplina = {
      id: slugify(nome) || `disciplina_${disciplinas.length + 1}`,
      nome,
      areaId: area ? area.id : null,
    };
    disciplinaMap.set(key, disciplina);
    disciplinas.push(disciplina);
    return disciplina;
  };

  const ensureAno = (label) => {
    const valor = normalizeText(label) || 'Geral';
    const key = normalizeLookupKey(valor);
    if (anoMap.has(key)) {
      return anoMap.get(key);
    }

    const nome = isGeneralLabel(valor) ? 'Geral' : valor;
    const ano = {
      id: isGeneralLabel(valor) ? 'geral' : slugify(valor) || `ano_${anos.length + 1}`,
      nome,
      ordem: inferYearOrder(nome),
      sourceValue: valor,
    };
    anoMap.set(key, ano);
    anos.push(ano);
    return ano;
  };

  ensureAno('Geral');

  (resultados || []).forEach((resultado) => {
    ensureDisciplina(resultado.disciplina);
    ensureAno(resultado.ano);
  });

  const habilidadesCanonicas = (habilidades || []).map((habilidade, index) => {
    const area = ensureArea(habilidade.area_conhecimento);
    const ano = ensureAno(habilidade.ano_escolar);
    const disciplina = area ? disciplinaMap.get(normalizeDimensionKey(area.nome)) || null : null;

    return {
      id:
        [
          area ? area.id : 'area',
          ano ? ano.id : 'ano',
          slugify(habilidade.codigo_habilidade || habilidade.habilidade || String(index + 1)),
        ].join('|'),
      codigo: normalizeText(habilidade.codigo_habilidade),
      descricao: normalizeText(habilidade.habilidade),
      tematica: normalizeText(habilidade.tematica),
      areaId: area ? area.id : null,
      disciplinaId: disciplina ? disciplina.id : null,
      anoId: ano ? ano.id : 'geral',
    };
  });

  return {
    rede: {
      id: context.redeId,
      nome: normalizeText(metadata.nome_rede) || context.municipio,
      municipio: context.municipio,
      anoLetivo: context.anoLetivo,
      ciclo: context.ciclo,
      dataAvaliacao: context.dataAvaliacao,
    },
    escolas: (escolas || []).map((escola) => ({
      id: String(escola.id_escola),
      redeId: context.redeId,
      nome: normalizeText(escola.nome_escola),
      status: normalizeText(escola.status) || null,
      previstos: toNullableNumber(escola.alunos_previstos),
      iniciaram: toNullableNumber(escola.alunos_iniciaram),
      finalizaram: toNullableNumber(escola.alunos_finalizaram),
      participacaoTotal: toNullableNumber(escola.participacao_total),
    })),
    areas,
    disciplinas,
    anos: sortYears(anos),
    habilidades: habilidadesCanonicas,
  };
}

function buildCanonicalFacts(raw, entities, context) {
  return {
    participacoes: buildParticipationFacts(raw, entities, context),
    proficiencias: buildProficiencyFacts(raw, entities, context),
    desempenhosHabilidade: buildSkillPerformanceFacts(raw.habilidades, entities.habilidades, context),
  };
}

function buildParticipationFacts(raw, entities, context) {
  const { metadata, escolas, resultados } = raw;
  const disciplinaLookup = buildNamedEntityLookup(entities.disciplinas);
  const anoLookup = buildNamedEntityLookup(entities.anos);
  const rawEscolaMap = new Map((escolas || []).map((escola) => [String(escola.id_escola), escola]));
  const facts = [];

  facts.push({
    assessmentId: context.assessmentId,
    scope: { type: 'rede', id: context.redeId },
    disciplinaId: null,
    anoId: 'geral',
    previstos: toNullableNumber(metadata.alunos_previstos),
    iniciaram: toNullableNumber(metadata.alunos_iniciaram),
    finalizaram: toNullableNumber(metadata.alunos_finalizaram),
    participantes: sumNumbersOrNull((resultados || []).map((row) => row.participantes)),
    taxaParticipacao: roundNullable(
      firstNonNullNumber([
        calculatePercent(metadata.alunos_finalizaram, metadata.alunos_previstos),
        averageNumbers((resultados || []).map((row) => row.participacao)),
      ]),
      1,
    ),
  });

  const redeGroups = groupBy((resultados || []).filter(Boolean), (row) => {
    const disciplinaId = resolveEntityId(row.disciplina, disciplinaLookup);
    const anoId = resolveEntityId(row.ano, anoLookup, 'geral');
    return `${disciplinaId}::${anoId}`;
  });

  for (const [key, rows] of redeGroups.entries()) {
    const [disciplinaId, anoId] = key.split('::');
    facts.push({
      assessmentId: context.assessmentId,
      scope: { type: 'rede', id: context.redeId },
      disciplinaId,
      anoId,
      previstos: null,
      iniciaram: null,
      finalizaram: null,
      participantes: sumNumbersOrNull(rows.map((row) => row.participantes)),
      taxaParticipacao: roundNullable(averageNumbers(rows.map((row) => row.participacao)), 1),
    });
  }

  (entities.escolas || []).forEach((escola) => {
    const rawEscola = rawEscolaMap.get(escola.id) || {};
    const escolaRows = (resultados || []).filter((row) => String(row.id_escola) === escola.id);
    facts.push({
      assessmentId: context.assessmentId,
      scope: { type: 'escola', id: escola.id },
      disciplinaId: null,
      anoId: 'geral',
      previstos: escola.previstos,
      iniciaram: escola.iniciaram,
      finalizaram: escola.finalizaram,
      participantes: sumNumbersOrNull(escolaRows.map((row) => row.participantes)),
      taxaParticipacao: roundNullable(
        firstNonNullNumber([
          escola.participacaoTotal,
          calculatePercent(rawEscola.alunos_finalizaram, rawEscola.alunos_previstos),
          averageNumbers(escolaRows.map((row) => row.participacao)),
        ]),
        1,
      ),
    });
  });

  const escolaGroups = groupBy((resultados || []).filter(Boolean), (row) => {
    const disciplinaId = resolveEntityId(row.disciplina, disciplinaLookup);
    const anoId = resolveEntityId(row.ano, anoLookup, 'geral');
    return `${String(row.id_escola)}::${disciplinaId}::${anoId}`;
  });

  for (const [key, rows] of escolaGroups.entries()) {
    const [escolaId, disciplinaId, anoId] = key.split('::');
    facts.push({
      assessmentId: context.assessmentId,
      scope: { type: 'escola', id: escolaId },
      disciplinaId,
      anoId,
      previstos: null,
      iniciaram: null,
      finalizaram: null,
      participantes: sumNumbersOrNull(rows.map((row) => row.participantes)),
      taxaParticipacao: roundNullable(averageNumbers(rows.map((row) => row.participacao)), 1),
    });
  }

  return facts;
}

function buildProficiencyFacts(raw, entities, context) {
  const { resultados, distribuicao } = raw;
  const disciplinaLookup = buildNamedEntityLookup(entities.disciplinas);
  const anoLookup = buildNamedEntityLookup(entities.anos);
  const facts = [];
  const distribuicaoPorEscola = groupBy((distribuicao || []).filter(Boolean), (row) => String(row.id_escola));
  const distribuicaoPorEscolaDisciplina = groupBy(
    (distribuicao || []).filter((row) => row && row.disciplina),
    (row) => `${String(row.id_escola)}::${normalizeDimensionKey(row.disciplina)}`,
  );
  const distribuicaoPorDisciplina = groupBy(
    (distribuicao || []).filter((row) => row && row.disciplina),
    (row) => normalizeDimensionKey(row.disciplina),
  );

  facts.push({
    assessmentId: context.assessmentId,
    scope: { type: 'rede', id: context.redeId },
    disciplinaId: null,
    anoId: 'geral',
    media: roundNullable(averageNumbers((resultados || []).map((row) => row.media)), 1),
    baseParticipantes: sumNumbersOrNull((resultados || []).map((row) => row.participantes)),
    distribuicao: buildDistributionFact(distribuicao),
  });

  const redeGroups = groupBy((resultados || []).filter(Boolean), (row) => {
    const disciplinaId = resolveEntityId(row.disciplina, disciplinaLookup);
    const anoId = resolveEntityId(row.ano, anoLookup, 'geral');
    return `${disciplinaId}::${anoId}`;
  });

  for (const [key, rows] of redeGroups.entries()) {
    const [disciplinaId, anoId] = key.split('::');
    const distRows = distribuicaoPorDisciplina.get(normalizeDimensionKey(rows[0].disciplina)) || [];
    facts.push({
      assessmentId: context.assessmentId,
      scope: { type: 'rede', id: context.redeId },
      disciplinaId,
      anoId,
      media: roundNullable(averageNumbers(rows.map((row) => row.media)), 1),
      baseParticipantes: sumNumbersOrNull(rows.map((row) => row.participantes)),
      distribuicao: buildDistributionFact(distRows),
    });
  }

  const escolaGroups = groupBy((resultados || []).filter(Boolean), (row) => {
    const disciplinaId = resolveEntityId(row.disciplina, disciplinaLookup);
    const anoId = resolveEntityId(row.ano, anoLookup, 'geral');
    return `${String(row.id_escola)}::${disciplinaId}::${anoId}`;
  });

  const resultadosPorEscola = groupBy((resultados || []).filter(Boolean), (row) => String(row.id_escola));

  for (const [escolaId, rows] of resultadosPorEscola.entries()) {
    facts.push({
      assessmentId: context.assessmentId,
      scope: { type: 'escola', id: escolaId },
      disciplinaId: null,
      anoId: 'geral',
      media: roundNullable(averageNumbers(rows.map((row) => row.media)), 1),
      baseParticipantes: sumNumbersOrNull(rows.map((row) => row.participantes)),
      distribuicao: buildDistributionFact(distribuicaoPorEscola.get(escolaId) || []),
    });
  }

  for (const [key, rows] of escolaGroups.entries()) {
    const [escolaId, disciplinaId, anoId] = key.split('::');
    const distKey = `${escolaId}::${normalizeDimensionKey(rows[0].disciplina)}`;
    facts.push({
      assessmentId: context.assessmentId,
      scope: { type: 'escola', id: escolaId },
      disciplinaId,
      anoId,
      media: roundNullable(averageNumbers(rows.map((row) => row.media)), 1),
      baseParticipantes: sumNumbersOrNull(rows.map((row) => row.participantes)),
      distribuicao: buildDistributionFact(distribuicaoPorEscolaDisciplina.get(distKey) || []),
    });
  }

  return facts;
}

function buildSkillPerformanceFacts(rawHabilidades, habilidades, context) {
  return (rawHabilidades || []).map((habilidade, index) => ({
    assessmentId: context.assessmentId,
    scope: { type: 'rede', id: context.redeId },
    habilidadeId: habilidades[index] ? habilidades[index].id : `habilidade_${index + 1}`,
    desempenhoPercentual: roundNullable(toNullableNumber(habilidade.desempenho_percentual), 2),
  }));
}

function buildDerivedModel({ entities, facts, rankings, paginatedRankings }) {
  return {
    comparativos: {
      escolaVsRede: buildEscolaVsRedeComparatives(entities, facts),
    },
    rankings: {
      porDisciplina: rankings,
      paginados: paginatedRankings,
    },
    indexes: buildCanonicalIndexes(entities),
  };
}

function buildEscolaVsRedeComparatives(entities, facts) {
  const escolaLookup = new Map((entities.escolas || []).map((item) => [item.id, item]));
  const disciplinaLookup = new Map((entities.disciplinas || []).map((item) => [item.id, item]));
  const anoLookup = new Map((entities.anos || []).map((item) => [item.id, item]));
  const redeProficiencias = new Map();
  const redeParticipacoes = new Map();
  const escolaParticipacoes = new Map();

  (facts.proficiencias || [])
    .filter((fact) => fact.scope.type === 'rede' && fact.disciplinaId)
    .forEach((fact) => {
      redeProficiencias.set(`${fact.disciplinaId}::${fact.anoId}`, fact);
    });

  (facts.participacoes || [])
    .filter((fact) => fact.scope.type === 'rede' && fact.disciplinaId)
    .forEach((fact) => {
      redeParticipacoes.set(`${fact.disciplinaId}::${fact.anoId}`, fact);
    });

  (facts.participacoes || [])
    .filter((fact) => fact.scope.type === 'escola')
    .forEach((fact) => {
      escolaParticipacoes.set(`${fact.scope.id}::${fact.disciplinaId || 'geral'}::${fact.anoId}`, fact);
    });

  return (facts.proficiencias || [])
    .filter((fact) => fact.scope.type === 'escola' && fact.disciplinaId)
    .map((fact) => {
      const key = `${fact.disciplinaId}::${fact.anoId}`;
      const redeFact = redeProficiencias.get(key) || redeProficiencias.get(`${fact.disciplinaId}::geral`);
      if (!redeFact) {
        return null;
      }

      const redeParticipation =
        redeParticipacoes.get(key) ||
        redeParticipacoes.get(`${fact.disciplinaId}::geral`) ||
        null;
      const escolaParticipation =
        escolaParticipacoes.get(`${fact.scope.id}::${fact.disciplinaId}::${fact.anoId}`) ||
        escolaParticipacoes.get(`${fact.scope.id}::geral::geral`) ||
        null;

      return {
        escolaId: fact.scope.id,
        escolaNome: (escolaLookup.get(fact.scope.id) || {}).nome || '',
        disciplinaId: fact.disciplinaId,
        disciplina: (disciplinaLookup.get(fact.disciplinaId) || {}).nome || fact.disciplinaId,
        anoId: fact.anoId,
        ano: (anoLookup.get(fact.anoId) || {}).nome || fact.anoId,
        escola: {
          media: fact.media,
          taxaParticipacao: escolaParticipation ? escolaParticipation.taxaParticipacao : null,
        },
        rede: {
          media: redeFact.media,
          taxaParticipacao: redeParticipation ? redeParticipation.taxaParticipacao : null,
        },
        delta: {
          media: roundNullable(subtractNumbers(fact.media, redeFact.media), 1),
          taxaParticipacao: roundNullable(
            subtractNumbers(
              escolaParticipation ? escolaParticipation.taxaParticipacao : null,
              redeParticipation ? redeParticipation.taxaParticipacao : null,
            ),
            1,
          ),
        },
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const escolaOrder = left.escolaNome.localeCompare(right.escolaNome);
      if (escolaOrder !== 0) return escolaOrder;
      const disciplinaOrder = left.disciplina.localeCompare(right.disciplina);
      if (disciplinaOrder !== 0) return disciplinaOrder;
      return left.ano.localeCompare(right.ano);
    });
}

function buildCanonicalIndexes(entities) {
  return {
    redeById: entities.rede ? { [entities.rede.id]: entities.rede } : {},
    escolaById: toObjectById(entities.escolas),
    areaById: toObjectById(entities.areas),
    disciplinaById: toObjectById(entities.disciplinas),
    anoById: toObjectById(entities.anos),
    habilidadeById: toObjectById(entities.habilidades),
  };
}

function buildDistributionFact(rows) {
  if (!rows || rows.length === 0) {
    return null;
  }

  const summary = computeDistribuicao(rows);
  return {
    total: summary.total,
    abaixo_do_basico: {
      percentual: summary.percentuais.abaixo_do_basico,
      alunos: summary.abaixo_do_basico,
    },
    basico: {
      percentual: summary.percentuais.basico,
      alunos: summary.basico,
    },
    adequado: {
      percentual: summary.percentuais.adequado,
      alunos: summary.adequado,
    },
    avancado: {
      percentual: summary.percentuais.avancado,
      alunos: summary.avancado,
    },
  };
}

function buildNamedEntityLookup(items) {
  const lookup = new Map();
  (items || []).forEach((item) => {
    if (!item) return;
    if (item.nome) {
      lookup.set(normalizeDimensionKey(item.nome), item.id);
    }
    if (item.sourceValue) {
      lookup.set(normalizeLookupKey(item.sourceValue), item.id);
    }
  });
  return lookup;
}

function resolveEntityId(value, lookup, fallback = null) {
  const key = normalizeDimensionKey(value);
  if (lookup.has(key)) {
    return lookup.get(key);
  }
  const sourceKey = normalizeLookupKey(value);
  if (lookup.has(sourceKey)) {
    return lookup.get(sourceKey);
  }
  return fallback;
}

function sortYears(anos) {
  return [...(anos || [])].sort((left, right) => {
    if (left.ordem !== right.ordem) {
      return left.ordem - right.ordem;
    }
    return left.nome.localeCompare(right.nome);
  });
}

function inferYearOrder(label) {
  if (isGeneralLabel(label)) {
    return 0;
  }

  const match = String(label || '').match(/(\d+)/);
  return match ? Number(match[1]) : 999;
}

function isGeneralLabel(label) {
  return normalizeLookupKey(label) === 'geral';
}

function normalizeDimensionKey(value) {
  return normalizeLookupKey(value)
    .replace(/^lingua portuguesa$/, 'portugues')
    .replace(/^lp$/, 'portugues');
}

function normalizeLookupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function averageNumbers(values) {
  const numeric = (values || []).map((value) => toNullableNumber(value)).filter((value) => value !== null);
  if (numeric.length === 0) {
    return null;
  }
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function sumNumbersOrNull(values) {
  const numeric = (values || []).map((value) => toNullableNumber(value)).filter((value) => value !== null);
  if (numeric.length === 0) {
    return null;
  }
  return numeric.reduce((sum, value) => sum + value, 0);
}

function calculatePercent(part, total) {
  const numerator = toNullableNumber(part);
  const denominator = toNullableNumber(total);
  if (numerator === null || denominator === null || denominator <= 0) {
    return null;
  }
  return (numerator / denominator) * 100;
}

function subtractNumbers(left, right) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return null;
  }
  return Number(left) - Number(right);
}

function roundNullable(value, decimals = 1) {
  return value === null || value === undefined ? null : round(Number(value), decimals);
}

function firstNonNullNumber(values) {
  for (const value of values || []) {
    const numeric = toNullableNumber(value);
    if (numeric !== null) {
      return numeric;
    }
  }
  return null;
}

function toObjectById(items) {
  return Object.fromEntries((items || []).filter(Boolean).map((item) => [item.id, item]));
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
  computeDistribuicaoPorDisciplina,
  round,
  PAGINATION_THRESHOLD_SCHOOLS,
  RANKING_MAX_PER_PAGE,
};
