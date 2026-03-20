'use strict';

const SECTION_LABELS = {
  capa: 'Capa',
  capitulo: 'Capítulo',
  sumario: 'Sumário',
  apresentacao: 'Apresentação',
  contexto_avaliacao: 'Contexto da Avaliação',
  participacao_rede: 'Durante a Aplicação',
  metodologia: 'Metodologia',
  visao_geral: 'Visão Geral da Rede',
  resultados_disciplina: 'Resultados por Disciplina',
  resultados_ano: 'Resultados por Ano/Série',
  ranking: 'Ranking de Escolas',
  habilidades_disciplina: 'Resultados por Habilidade',
  escola: 'Painel da Escola',
  escola_disciplinas: 'Comparativo da Escola',
  proximos_passos: 'Próximos Passos',
};

function buildPageChrome(page, metadata, options = {}) {
  const data = (page && page.data) || {};
  const totalPages = toPositiveInteger(options.totalPages);
  const version = normalizeText(options.version) || 'v1';
  const rankingPosition = extractRankingPosition(page);
  const section = normalizeText(page && page.section);
  const isNetworkOverview = section === 'visao_geral';
  const isSchoolComparison = section === 'escola_disciplinas';
  const numericPage = toPositiveInteger(page && page.pageNumber);
  const editionParts = [
    normalizeText(metadata && metadata.municipio),
    normalizeText(metadata && metadata.ciclo),
    normalizeText(metadata && metadata.ano),
    version,
  ].filter(Boolean);

  return {
    variant: section === 'capa' || section === 'capitulo' ? 'opener' : 'default',
    sectionLabel: resolveSectionLabel(page),
    pageLabel: buildPageLabel(numericPage, totalPages),
    pageBadgeValue: numericPage ? String(numericPage) : '',
    pageBadgeDetail: totalPages && numericPage ? `de ${totalPages}` : 'Página',
    editionLabel: isNetworkOverview || isSchoolComparison ? 'Relatório Diagnóstico Educacional' : editionParts.join(' • '),
    rankingBadge: !data.hideRankingBadge && rankingPosition ? `Posição Geral: ${rankingPosition}º` : '',
    footerCenter:
      normalizeText(data.footerCenter) ||
      (rankingPosition ? `Ranking geral da rede: ${rankingPosition}º lugar` : ''),
    footerRight: normalizeText(data.footerRight) || (isNetworkOverview && numericPage ? String(numericPage) : ''),
  };
}

function resolvePageChromeSpec(page) {
  const layout = (page && page.layout) || {};
  const mode = normalizeText(layout.chromeMode) || 'legacy';
  const frameId = normalizeText(layout.frameId) || '';

  return {
    mode,
    frameId,
    hasCustomFrame: mode !== 'legacy' || Boolean(frameId),
  };
}

function resolveSectionLabel(page) {
  const data = (page && page.data) || {};
  const chromeLabel = normalizeText(data.chromeSectionLabel);
  if (chromeLabel) {
    return chromeLabel;
  }
  const section = normalizeText(page && page.section);
  return SECTION_LABELS[section] || normalizeText(page && page.title) || section || 'Página';
}

function extractRankingPosition(page) {
  const data = (page && page.data) || {};
  const rankingPosition = data.rankingPosition;
  const numeric = Number(rankingPosition);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function buildPageLabel(pageNumber, totalPages) {
  const numericPage = toPositiveInteger(pageNumber);
  if (!numericPage) {
    return 'Página';
  }
  if (!totalPages) {
    return `Página ${numericPage}`;
  }
  return `Página ${numericPage} de ${totalPages}`;
}

function normalizeText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function toPositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return 0;
  }
  return numeric;
}

module.exports = {
  buildPageChrome,
  extractRankingPosition,
  resolvePageChromeSpec,
  resolveSectionLabel,
};
