'use strict';

/**
 * Renderer — Book de Resultados
 *
 * Transforms BookMetrics into an array of Page objects, each
 * representing a page of the report.
 *
 * Page types (section):
 *   capa               — Cover page
 *   apresentacao       — Presentation page
 *   sumario            — Table of contents (auto-generated)
 *   visao_geral        — Network overview
 *   resultados_disciplina — Per-discipline results
 *   ranking            — School ranking (one page per discipline, paginated)
 *   escola             — Per-school results (one page per school)
 *   resultados_ano     — Per-year/series results
 *   metodologia        — Methodology page
 */

/**
 * Renders a full list of pages from computed book metrics.
 * @param {BookMetrics} metrics
 * @param {object} [options]
 * @param {string} [options.logoUrl] - Optional logo image path/URL
 * @param {string} [options.imagemInstitucional] - Optional cover image path/URL
 * @returns {Page[]}
 */
function render(metrics, options = {}) {
  const { metadata, rede, escolas, paginatedRankings, disciplinas, anos } = metrics;
  const pages = [];

  // 1 — Capa
  pages.push(buildCapa(metadata, options));

  // 2 — Apresentação
  pages.push(buildApresentacao(metadata, rede));

  // 3 — Sumário (placeholder — filled after all pages are built)
  const sumarioPage = buildSumarioPlaceholder();
  pages.push(sumarioPage);

  // 4 — Visão Geral da Rede
  pages.push(buildVisaoGeral(metadata, rede));

  // 5 — Resultados por Disciplina
  disciplinas.forEach((disciplina) => {
    pages.push(buildResultadosDisciplina(disciplina, rede));
  });

  // 6 — Ranking de Escolas (per discipline, paginated)
  for (const [disciplina, rankingPages] of Object.entries(paginatedRankings)) {
    rankingPages.forEach((pageRows, pageIdx) => {
      pages.push(buildRankingPage(disciplina, pageRows, pageIdx, rankingPages.length));
    });
  }

  // 7 — Resultados por Escola (one page per school)
  escolas.forEach((escola) => {
    pages.push(buildEscolaPage(escola, rede));
  });

  // 8 — Resultados por Ano/Série
  anos.forEach((ano) => {
    pages.push(buildResultadosAno(ano, rede, escolas));
  });

  // 9 — Metodologia
  pages.push(buildMetodologia(metadata, rede));

  // Assign page numbers
  pages.forEach((page, idx) => {
    page.pageNumber = idx + 1;
  });

  // Fill sumário with real page numbers
  fillSumario(sumarioPage, pages);

  return pages;
}

// ─── Page builders ───────────────────────────────────────────────────────────

function buildCapa(metadata, options) {
  return {
    section: 'capa',
    title: 'Capa',
    data: {
      municipio: metadata.municipio || '',
      ano: metadata.ano || '',
      ciclo: metadata.ciclo || '',
      data: metadata.data || '',
      logoUrl: options.logoUrl || null,
      imagemInstitucional: options.imagemInstitucional || null,
    },
  };
}

function buildApresentacao(metadata, rede) {
  return {
    section: 'apresentacao',
    title: 'Apresentação',
    data: {
      municipio: metadata.municipio || '',
      ciclo: metadata.ciclo || '',
      totalEscolas: rede.totalEscolas,
      totalAlunos: rede.totalAlunos,
    },
  };
}

function buildSumarioPlaceholder() {
  return {
    section: 'sumario',
    title: 'Sumário',
    data: { entries: [] },
  };
}

function buildVisaoGeral(metadata, rede) {
  return {
    section: 'visao_geral',
    title: 'Visão Geral da Rede',
    data: {
      municipio: metadata.municipio || '',
      totalEscolas: rede.totalEscolas,
      totalAlunos: rede.totalAlunos,
      participacaoMedia: rede.participacaoMedia,
      mediaGeral: rede.mediaGeral,
      distribuicao: rede.distribuicao,
      mediasPorDisciplina: rede.mediasPorDisciplina,
    },
  };
}

function buildResultadosDisciplina(disciplina, rede) {
  const mediaDisciplina = (rede.mediasPorDisciplina || {})[disciplina] || { media: 0, participacao: 0 };
  return {
    section: 'resultados_disciplina',
    title: `Resultados — ${disciplina}`,
    data: {
      disciplina,
      media: mediaDisciplina.media,
      participacao: mediaDisciplina.participacao,
      distribuicao: rede.distribuicao,
    },
  };
}

function buildRankingPage(disciplina, rows, pageIdx, totalPages) {
  return {
    section: 'ranking',
    title: `Ranking de Escolas — ${disciplina}${totalPages > 1 ? ` (${pageIdx + 1}/${totalPages})` : ''}`,
    data: {
      disciplina,
      rows,
      pageIndex: pageIdx,
      totalPages,
    },
  };
}

function buildEscolaPage(escola, rede) {
  const rankingPosition = null; // Populated by renderer if needed

  return {
    section: 'escola',
    title: escola.nome_escola,
    data: {
      id_escola: escola.id_escola,
      nome_escola: escola.nome_escola,
      totalAlunos: escola.totalAlunos,
      participacao: escola.participacao,
      media: escola.media,
      mediaRede: rede.mediaGeral,
      rankingPosition,
      distribuicao: escola.distribuicao,
      resultadosPorAno: escola.resultadosPorAno,
    },
  };
}

function buildResultadosAno(ano, rede, escolas) {
  const escolasDoAno = escolas
    .map((e) => {
      const rows = (e.resultadosPorAno || []).filter((r) => String(r.ano) === String(ano));
      if (rows.length === 0) return null;
      const media = rows.reduce((sum, r) => sum + r.media, 0) / rows.length;
      return { id_escola: e.id_escola, nome_escola: e.nome_escola, media: Math.round(media * 10) / 10 };
    })
    .filter(Boolean)
    .sort((a, b) => b.media - a.media);

  return {
    section: 'resultados_ano',
    title: `Resultados por Ano/Série — ${ano}`,
    data: {
      ano,
      mediaRede: rede.mediaGeral,
      distribuicao: rede.distribuicao,
      escolas: escolasDoAno,
    },
  };
}

function buildMetodologia(metadata, rede) {
  return {
    section: 'metodologia',
    title: 'Metodologia',
    data: {
      totalAlunos: rede.totalAlunos,
      disciplinas: Object.keys(rede.mediasPorDisciplina || {}),
      municipio: metadata.municipio || '',
      ciclo: metadata.ciclo || '',
      ano: metadata.ano || '',
    },
  };
}

/**
 * Fills the sumário page with entries pointing to actual page numbers.
 * @param {object} sumarioPage
 * @param {object[]} pages
 */
function fillSumario(sumarioPage, pages) {
  const entries = pages
    .filter((p) => p.section !== 'sumario')
    .map((p) => ({ title: p.title, page: p.pageNumber }));

  sumarioPage.data.entries = entries;
}

module.exports = { render };
