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
 *   escola_disciplinas — Per-school comparative (one page per school)
 *   resultados_ano     — Per-year/series results
 *   habilidades_disciplina — Skill table per discipline (paginated)
 *   metodologia        — Methodology page
 */

const { buildProficienciaComponent, buildHabilidadesTable, buildComparativoComponent } = require('./components');
const { createTheme } = require('./theme');
const {
  resolveManifestSectionLayout,
  loadDefaultDesignManifest,
  resolveSectionComponent,
  resolveChapterComponent,
} = require('./design-manifest');

const DEFAULT_EDITORIAL_LAYOUT = {
  templateId: 'generic-page',
  variant: 'standard',
  sectionGroup: 'analitico',
  density: 'standard',
  breakPolicy: 'always',
  reviewPriority: 'secondary',
};

const PARTICIPACAO_REDE_TABLE_MAX_ROWS = 18;

const EDITORIAL_LAYOUT_BY_SECTION = {
  capa: {
    templateId: 'cover-page',
    variant: 'institutional-cover',
    sectionGroup: 'editorial',
    density: 'immersive',
    breakPolicy: 'always',
    reviewPriority: 'primary',
  },
  apresentacao: {
    templateId: 'editorial-opening',
    variant: 'institutional-intro',
    sectionGroup: 'editorial',
    density: 'comfortable',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  sumario: {
    templateId: 'table-of-contents',
    variant: 'summary',
    sectionGroup: 'navegacao',
    density: 'comfortable',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  capitulo: {
    templateId: 'chapter-opener',
    variant: 'chapter',
    sectionGroup: 'editorial',
    density: 'immersive',
    breakPolicy: 'always',
    reviewPriority: 'primary',
  },
  contexto_avaliacao: {
    templateId: 'editorial-body',
    variant: 'context',
    sectionGroup: 'editorial',
    density: 'comfortable',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  participacao_rede: {
    templateId: 'editorial-body',
    variant: 'participation',
    sectionGroup: 'editorial',
    density: 'comfortable',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  participacao_rede_tabela: {
    templateId: 'editorial-table',
    variant: 'participation-table',
    sectionGroup: 'editorial',
    density: 'dense',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  metodologia: {
    templateId: 'editorial-body',
    variant: 'methodology',
    sectionGroup: 'editorial',
    density: 'comfortable',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  visao_geral: {
    templateId: 'network-overview',
    variant: 'overview',
    sectionGroup: 'analitico',
    density: 'balanced',
    breakPolicy: 'always',
    reviewPriority: 'primary',
  },
  resultados_disciplina: {
    templateId: 'discipline-results',
    variant: 'discipline',
    sectionGroup: 'analitico',
    density: 'balanced',
    breakPolicy: 'always',
    reviewPriority: 'primary',
  },
  resultados_ano: {
    templateId: 'year-results',
    variant: 'year-overview',
    sectionGroup: 'analitico',
    density: 'balanced',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  ranking: {
    templateId: 'ranking-table',
    variant: 'ranking',
    frameId: 'ranking-frame',
    chromeMode: 'framed',
    sectionGroup: 'analitico',
    density: 'dense',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  habilidades_disciplina: {
    templateId: 'skills-table',
    variant: 'skills',
    frameId: 'skills-frame',
    chromeMode: 'framed',
    sectionGroup: 'analitico',
    density: 'dense',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  escola: {
    templateId: 'school-overview',
    variant: 'school-summary',
    frameId: 'school-frame',
    chromeMode: 'framed',
    sectionGroup: 'analitico',
    density: 'balanced',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  escola_disciplinas: {
    templateId: 'school-comparison',
    variant: 'school-comparison',
    frameId: 'school-frame',
    chromeMode: 'framed',
    sectionGroup: 'analitico',
    density: 'balanced',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
  proximos_passos: {
    templateId: 'editorial-body',
    variant: 'next-steps',
    sectionGroup: 'editorial',
    density: 'comfortable',
    breakPolicy: 'always',
    reviewPriority: 'secondary',
  },
};

/**
 * Renders a full list of pages from computed book metrics.
 * @param {BookMetrics} metrics
 * @param {object} [options]
 * @param {string} [options.logoUrl] - Optional logo image path/URL
 * @param {string} [options.imagemInstitucional] - Optional cover image path/URL
 * @param {object} [options.editorialAssets] - Optional editorial image paths for chapter/narrative openers
 * @param {object} [options.theme] - Optional theme overrides (merged with DEFAULT_THEME)
 * @param {object} [options.designManifest] - Optional resolved design manifest
 * @returns {Page[]}
 */
function render(metrics, options = {}) {
  const { metadata, rede, escolas, paginatedRankings, disciplinas, anos, entities, facts, derived } = metrics;
  const designManifest = options.designManifest || loadDefaultDesignManifest();
  const manifestAssets = designManifest.assets || {};
  const resolvedOptions = {
    ...options,
    designManifest,
    logoUrl: options.logoUrl || manifestAssets.logoUrl || null,
    imagemInstitucional: options.imagemInstitucional || manifestAssets.imagemInstitucional || null,
    editorialAssets: options.editorialAssets || manifestAssets.editorialAssets || null,
  };
  const theme = createTheme(resolvedOptions.theme || {});
  const pages = [];
  const editorialContext = {
    metadata,
    rede,
    escolas,
    paginatedRankings,
    disciplinas,
    anos,
    entities,
    facts,
    derived,
    options: resolvedOptions,
    theme,
  };

  // 1 — Capa
  pages.push(buildCapa(metadata, resolvedOptions));

  // 2 — Apresentação
  pages.push(buildApresentacao(metadata, rede));

  // 3 — Sumário (placeholder — filled after all pages are built)
  const sumarioPage = buildSumarioPlaceholder();
  pages.push(sumarioPage);

  buildEditorialChapters(editorialContext).forEach((chapter, chapterIndex) => {
    pages.push(buildChapterPage(chapter, chapterIndex + 1));

    chapter.pageBuilders.forEach((builder) => {
      const builtPage = builder(editorialContext);
      if (Array.isArray(builtPage)) {
        pages.push(...builtPage);
        return;
      }

      if (builtPage) {
        pages.push(builtPage);
      }
    });
  });

  // Assign page numbers
  pages.forEach((page, idx) => {
    page.pageNumber = idx + 1;
  });

  // Fill sumário with real page numbers
  fillSumario(sumarioPage, pages);

  pages.forEach((page) => {
    page.layout = Object.assign({}, resolveEditorialLayout(page, designManifest), page.layout || {});
  });

  return pages;
}

// ─── Page builders ───────────────────────────────────────────────────────────

function buildEditorialChapters(context = {}) {
  const editorialAssets = (context.options && context.options.editorialAssets) || {};
  const designManifest = context.options && context.options.designManifest;
  const resultadosChapterComponent = resolveChapterComponent('resultados', designManifest);
  const resultadosChapterAssets = (resultadosChapterComponent && resultadosChapterComponent.assets) || {};
  return [
    {
      key: 'antes',
      title: 'Antes da Avaliação',
      summary: 'Contextualização institucional do ciclo, do escopo e da rede participante.',
      pageBuilders: [({ metadata, rede }) => buildContextoAvaliacao(metadata, rede)],
    },
    {
      key: 'durante',
      title: 'Durante a Aplicação',
      summary: 'Síntese do processo de aplicação, cobertura da rede e metodologia adotada.',
      pageBuilders: [
        ({ metadata, rede, escolas, entities, facts, options }) => buildParticipacaoRede(metadata, rede, escolas, entities, facts, options),
        ({ metadata, rede }) => buildMetodologia(metadata, rede),
      ],
    },
    {
      key: 'resultados',
      title: 'Resultados',
      summary: 'Leitura analítica da rede, dos recortes disciplinares, dos anos e das escolas.',
      chapterDisplayIndex: 2,
      chapterEyebrow: 'Instrumentos de avaliação',
      chapterEyebrowSecondary: 'Educacross',
      imageUrl: editorialAssets.chapterResultadosImageUrl || resultadosChapterAssets.imageUrl || null,
      overlayImageUrl: editorialAssets.chapterResultadosOverlayImageUrl || resultadosChapterAssets.overlayImageUrl || null,
      imageAlt: editorialAssets.chapterResultadosImageAlt || resultadosChapterAssets.imageAlt || 'Abertura do capítulo Resultados',
      pageBuilders: [
        ({ metadata, rede, theme }) => buildVisaoGeral(metadata, rede, theme),
        ({ disciplinas, rede, theme }) => disciplinas.map((disciplina) => buildResultadosDisciplina(disciplina, rede, theme)),
        ({ anos, rede, escolas }) => anos.map((ano) => buildResultadosAno(ano, rede, escolas, anos.length)),
        ({ paginatedRankings }) => buildRankingPages(paginatedRankings),
        ({ entities, facts, disciplinas, theme }) => buildHabilidadesPages(entities, facts, disciplinas, theme),
        ({ escolas, rede, metadata, entities, facts, derived, theme, options }) =>
          escolas.flatMap((escola) => buildEscolaPages(escola, rede, metadata, { entities, facts, derived }, theme, options.designManifest)),
      ],
    },
    {
      key: 'proximos_passos',
      title: 'Próximos Passos',
      summary: 'Encaminhamentos institucionais sugeridos a partir dos resultados consolidados.',
      pageBuilders: [({ metadata, rede, escolas, disciplinas }) => buildProximosPassos(metadata, rede, escolas, disciplinas)],
    },
  ];
}

function buildChapterPage(chapter, chapterIndex = 1) {
  return {
    section: 'capitulo',
    title: chapter.title,
    data: {
      chapterIndex,
      chapterDisplayIndex: chapter.chapterDisplayIndex || chapterIndex,
      chapterKey: chapter.key,
      chapterTitle: chapter.title,
      chapterEyebrow: chapter.chapterEyebrow || null,
      chapterEyebrowSecondary: chapter.chapterEyebrowSecondary || null,
      summary: chapter.summary,
      imageUrl: chapter.imageUrl || null,
      overlayImageUrl: chapter.overlayImageUrl || null,
      imageAlt: chapter.imageAlt || null,
    },
  };
}

function buildCapa(metadata, options) {
  const coverComponent = resolveSectionComponent('capa', options.designManifest);
  const coverAssets = (coverComponent && coverComponent.assets) || {};
  return {
    section: 'capa',
    title: 'Capa',
    data: {
      nomeRede: metadata.nome_rede || metadata.municipio || '',
      municipio: metadata.municipio || '',
      ano: metadata.ano || '',
      ciclo: metadata.ciclo || '',
      data: metadata.data || '',
      logoUrl: options.logoUrl || coverAssets.logoUrl || null,
      imagemInstitucional: options.imagemInstitucional || coverAssets.imagemInstitucional || null,
    },
  };
}

function buildApresentacao(metadata, rede) {
  return {
    section: 'apresentacao',
    title: 'Apresentação',
    data: {
      chromeSectionLabel: 'Abertura',
      layoutHeading: 'Panorama institucional do ciclo',
      layoutSubheading: metadata.municipio || '',
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

function buildContextoAvaliacao(metadata, rede) {
  return {
    section: 'contexto_avaliacao',
    title: 'Contexto da Avaliação',
    data: {
      chromeSectionLabel: 'Antes da Avaliação',
      layoutHeading: 'Contexto da avaliação',
      layoutSubheading: metadata.municipio || '',
      body: `No município de ${metadata.municipio || ''}, o ciclo ${metadata.ciclo || ''} consolida o acompanhamento da aprendizagem da rede. Nesta edição, ${rede.totalEscolas} escolas e ${rede.totalAlunos} estudantes compõem o recorte institucional apresentado neste book.`,
    },
  };
}

function buildParticipacaoRede(metadata, rede, escolas, entities, facts, options = {}) {
  const editorialAssets = options.editorialAssets || {};
  const participationComponent = resolveSectionComponent('participacao_rede', options.designManifest);
  const participationAssets = (participationComponent && participationComponent.assets) || {};
  const disciplinasAvaliadas = Object.keys(rede.mediasPorDisciplina || {}).length;
  const municipality = metadata.municipio || '';
  const bodySegments = [
    `Este capítulo apresenta, nas tabelas a seguir, o número de alunos do município de ${municipality} que responderam à Avaliação Digital em cada uma das unidades temáticas aplicadas.`,
    'Como é comum em avaliações educacionais, nem todos os alunos respondem aos instrumentos avaliativos, como nem todos que os respondem o fazem de forma completa. Por isso, o total de alunos em cada uma das tabelas deste relatório pode ser diferente.',
  ];

  const abertura = {
    section: 'participacao_rede',
    title: 'Durante a Aplicação',
    data: {
      chromeSectionLabel: 'Durante a Aplicação',
      layoutHeading: 'Participação da rede',
      layoutSubheading: metadata.municipio || '',
      imageUrl: editorialAssets.participacaoImageUrl || participationAssets.imageUrl || null,
      imageAlt: editorialAssets.participacaoImageAlt || participationAssets.imageAlt || 'Abertura da seção de participação',
      participacaoMedia: rede.participacaoMedia,
      totalAlunos: rede.totalAlunos,
      totalEscolas: rede.totalEscolas,
      disciplinasAvaliadas,
      body: bodySegments.join(' '),
      paragraphs: bodySegments,
    },
  };

  const tabelas = buildParticipacaoRedeTablePages(metadata, escolas, entities, facts);

  return [abertura, ...tabelas];
}

function buildParticipacaoRedeTablePages(metadata, escolas, entities, facts) {
  const rows = buildParticipacaoRedeTableRows(escolas, entities, facts);
  if (rows.length === 0) {
    return [];
  }

  const disciplinas = resolveParticipacaoRedeDisciplinas(rows);
  const pages = [];

  disciplinas.forEach((disciplina) => {
    const disciplineRows = rows
      .map((row) => ({
        nomeEscola: row.nomeEscola,
        total: row.disciplinas && row.disciplinas[disciplina]
          ? row.disciplinas[disciplina].participantes
          : null,
      }))
      .filter((row) => row.total != null);

    if (disciplineRows.length === 0) {
      return;
    }

    const totalPages = Math.ceil(disciplineRows.length / PARTICIPACAO_REDE_TABLE_MAX_ROWS);

    for (let index = 0; index < totalPages; index += 1) {
      const start = index * PARTICIPACAO_REDE_TABLE_MAX_ROWS;
      const end = start + PARTICIPACAO_REDE_TABLE_MAX_ROWS;
      pages.push({
        section: 'participacao_rede_tabela',
        title: 'Participação por escola',
        data: {
          chromeSectionLabel: 'Durante a Aplicação',
          layoutHeading: 'Participação por escola',
          layoutSubheading: metadata.municipio || '',
          tableTitle: `Número de Alunos por Escola que fizeram a Prova de ${disciplina}`,
          discipline: disciplina,
          disciplineKey: normalizeParticipationDisciplineKey(disciplina),
          columns: buildParticipacaoRedeColumns(),
          rows: disciplineRows.slice(start, end),
          pageIndex: index,
          totalPages,
          totalEscolas: disciplineRows.length,
        },
      });
    }
  });

  return pages;
}

function buildParticipacaoRedeTableRows(escolas, entities, facts) {
  const schoolEntities = new Map(
    ((entities || {}).escolas || []).map((escola) => [String(escola.id), escola]),
  );

  const participationFacts = ((facts || {}).participacoes || []).filter(
    (fact) => fact && fact.scope && fact.scope.type === 'escola' && String(fact.anoId || 'geral') === 'geral',
  );
  const generalFacts = new Map();
  const disciplineFacts = new Map();

  participationFacts.forEach((fact) => {
    const schoolId = String(fact.scope.id);
    if (!fact.disciplinaId) {
      generalFacts.set(schoolId, fact);
      return;
    }

    if (!disciplineFacts.has(schoolId)) {
      disciplineFacts.set(schoolId, new Map());
    }

    disciplineFacts.get(schoolId).set(String(fact.disciplinaId), fact);
  });

  const disciplinasById = new Map(
    ((entities || {}).disciplinas || []).map((disciplina) => [String(disciplina.id), disciplina.nome]),
  );

  return (escolas || []).map((escola) => {
    const schoolId = String(escola.id_escola);
    const schoolEntity = schoolEntities.get(schoolId) || {};
    const generalFact = generalFacts.get(schoolId) || null;
    const factByDisciplina = disciplineFacts.get(schoolId) || new Map();
    const disciplinaParticipation = {};

    const resultRows = (escola.resultadosPorAno || []).filter(Boolean);
    resultRows.forEach((row) => {
      if (!row.disciplina) return;
      if (disciplinaParticipation[row.disciplina] != null) {
        return;
      }

      disciplinaParticipation[row.disciplina] = {
        participacao: roundValue(row.participacao),
        participantes: estimateParticipantsFromPercentage(
          schoolEntity.previstos != null ? schoolEntity.previstos : escola.totalAlunos,
          row.participacao,
        ),
      };
    });

    factByDisciplina.forEach((fact, disciplinaId) => {
      const disciplinaNome = disciplinasById.get(String(disciplinaId));
      if (!disciplinaNome || disciplinaParticipation[disciplinaNome] != null) {
        return;
      }
      disciplinaParticipation[disciplinaNome] = {
        participacao: roundValue(fact.taxaParticipacao),
        participantes: fact.participantes != null ? Number(fact.participantes) : null,
      };
    });

    return {
      nomeEscola: escola.nome_escola,
      previstos: schoolEntity.previstos != null ? schoolEntity.previstos : escola.totalAlunos,
      participacaoTotal: generalFact && generalFact.taxaParticipacao != null
        ? roundValue(generalFact.taxaParticipacao)
        : roundValue(escola.participacao),
      disciplinas: disciplinaParticipation,
    };
  });
}

function resolveParticipacaoRedeDisciplinas(rows) {
  const preferredOrder = ['Matemática', 'Língua Portuguesa', 'Português'];
  const discovered = new Set();

  (rows || []).forEach((row) => {
    Object.keys(row.disciplinas || {}).forEach((disciplina) => discovered.add(disciplina));
  });

  return [...discovered].sort((left, right) => {
    const leftPreferred = preferredOrder.indexOf(left);
    const rightPreferred = preferredOrder.indexOf(right);

    if (leftPreferred !== -1 || rightPreferred !== -1) {
      return (leftPreferred === -1 ? Number.MAX_SAFE_INTEGER : leftPreferred)
        - (rightPreferred === -1 ? Number.MAX_SAFE_INTEGER : rightPreferred);
    }

    return String(left).localeCompare(String(right), 'pt-BR');
  });
}

function buildParticipacaoRedeColumns() {
  return [
    { key: 'nomeEscola', label: 'Escola', type: 'text' },
    { key: 'total', label: 'Total', type: 'integer', numeric: true },
  ];
}

function normalizeParticipationDisciplineKey(disciplina) {
  const normalized = String(disciplina || '').trim().toLowerCase();
  if (normalized === 'matemática' || normalized === 'matematica') return 'matematica';
  if (normalized === 'língua portuguesa' || normalized === 'lingua portuguesa' || normalized === 'português' || normalized === 'portugues') return 'lingua-portuguesa';
  return normalized.replace(/\s+/g, '-');
}

function estimateParticipantsFromPercentage(totalPrevistos, participacao) {
  const total = Number(totalPrevistos);
  const percent = Number(participacao);
  if (!Number.isFinite(total) || !Number.isFinite(percent)) {
    return null;
  }

  return Math.round(total * percent / 100);
}

function buildVisaoGeral(metadata, rede, theme) {
  return {
    section: 'visao_geral',
    title: 'Visão Geral da Rede',
    data: {
      chromeSectionLabel: 'Resultados da Rede',
      layoutHeading: 'Visão geral da rede',
      layoutSubheading: metadata.municipio || '',
      municipio: metadata.municipio || '',
      totalEscolas: rede.totalEscolas,
      totalAlunos: rede.totalAlunos,
      participacaoMedia: rede.participacaoMedia,
      mediaGeral: rede.mediaGeral,
      distribuicao: rede.distribuicao,
      mediasPorDisciplina: rede.mediasPorDisciplina,
      components: {
        proficiencia: buildProficienciaComponent(
          rede.distribuicao,
          { title: 'Distribuição de Proficiência — Rede' },
          theme,
        ),
      },
    },
  };
}

function buildResultadosDisciplina(disciplina, rede, theme) {
  const mediaDisciplina = (rede.mediasPorDisciplina || {})[disciplina] || { media: 0, participacao: 0 };
  const distribuicaoDisciplina = (rede.distribuicaoPorDisciplina || {})[disciplina] || rede.distribuicao;
  return {
    section: 'resultados_disciplina',
    title: `Resultados — ${disciplina}`,
    data: {
      chromeSectionLabel: 'Resultados por Área',
      layoutHeading: `Resultados em ${disciplina}`,
      layoutSubheading: 'Leitura da rede',
      disciplina,
      media: mediaDisciplina.media,
      participacao: mediaDisciplina.participacao,
      distribuicao: distribuicaoDisciplina,
      components: {
        proficiencia: buildProficienciaComponent(
          distribuicaoDisciplina,
          { title: `Distribuição de Proficiência — ${disciplina}` },
          theme,
        ),
      },
    },
  };
}

function buildRankingPages(paginatedRankings) {
  const pages = [];

  for (const [disciplina, rankingPages] of Object.entries(paginatedRankings || {})) {
    rankingPages.forEach((pageRows, pageIdx) => {
      pages.push(buildRankingPage(disciplina, pageRows, pageIdx, rankingPages.length));
    });
  }

  return pages;
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

function buildEscolaPages(escola, rede, metadata = {}, canonicalModel = {}, theme, designManifest = null) {
  const rankingPosition = escola.rankingPosition || null;
  const operacional = buildSchoolOperationalSnapshot(escola, canonicalModel);
  const comparativos = buildSchoolComparatives(escola, canonicalModel);
  const participacaoPorDisciplina = comparativos.map((comparativo) => ({
    disciplina: comparativo.disciplina,
    participacaoEscola: comparativo.escola.taxaParticipacao,
    participacaoRede: comparativo.rede.taxaParticipacao,
    deltaParticipacao: comparativo.delta.taxaParticipacao,
    mediaEscola: comparativo.escola.media,
    mediaRede: comparativo.rede.media,
    deltaMedia: comparativo.delta.media,
  }));
  const sintese = buildSchoolSummary(escola, rede, operacional, participacaoPorDisciplina, rankingPosition);

  return [
    buildEscolaPage(escola, rede, metadata, operacional, sintese, rankingPosition, theme, designManifest),
    buildEscolaComparativosPage(
      escola,
      rede,
      metadata,
      operacional,
      participacaoPorDisciplina,
      sintese,
      rankingPosition,
      comparativos,
      theme,
    ),
  ];
}

function buildEscolaPage(escola, rede, metadata, operacional, sintese, rankingPosition, theme, designManifest = null) {
  const schoolComponent = resolveSectionComponent('escola', designManifest);
  const schoolAssets = (schoolComponent && schoolComponent.assets) || {};
  return {
    section: 'escola',
    title: escola.nome_escola,
    data: {
      chromeSectionLabel: 'Painel da Escola',
      layoutHeading: escola.nome_escola,
      layoutSubheading: 'Panorama geral da escola',
      id_escola: escola.id_escola,
      nome_escola: escola.nome_escola,
      municipio: metadata.municipio || '',
      totalAlunos: escola.totalAlunos,
      participacao: escola.participacao,
      media: escola.media,
      mediaRede: rede.mediaGeral,
      rankingPosition,
      hideRankingBadge: true,
      footerRight: 'Resultados',
      schoolMascotAsset: schoolAssets.mascotImageUrl || null,
      schoolEyebrowPrefix: schoolAssets.eyebrowPrefix || null,
      operacional,
      distribuicao: escola.distribuicao,
      distribuicaoPorDisciplina: escola.distribuicaoPorDisciplina || {},
      sintese,
      resultadosPorAno: escola.resultadosPorAno,
      components: {
        proficiencia: buildProficienciaComponent(
          escola.distribuicao,
          { title: `Distribuição de Proficiência — ${escola.nome_escola}` },
          theme,
        ),
      },
    },
  };
}

function buildEscolaComparativosPage(
  escola,
  rede,
  metadata,
  operacional,
  participacaoPorDisciplina,
  sintese,
  rankingPosition,
  rawComparativos,
  theme,
) {
  return {
    section: 'escola_disciplinas',
    title: `${escola.nome_escola} — Participação por Área`,
    data: {
      chromeSectionLabel: 'Geral da Escola',
      layoutHeading: 'Proficiência e habilidades',
      layoutSubheading: 'por área do conhecimento • Geral da Escola',
      id_escola: escola.id_escola,
      nome_escola: escola.nome_escola,
      municipio: metadata.municipio || '',
      rankingPosition: rankingPosition || null,
      hideRankingBadge: true,
      footerRight: 'Resultados',
      totalAlunos: escola.totalAlunos,
      participacao: escola.participacao,
      media: escola.media,
      mediaRede: rede.mediaGeral,
      operacional,
      distribuicao: escola.distribuicao,
      distribuicaoPorDisciplina: escola.distribuicaoPorDisciplina || {},
      redeDistribuicaoPorDisciplina: rede.distribuicaoPorDisciplina || {},
      resultadosPorAno: escola.resultadosPorAno || [],
      participacaoPorDisciplina,
      sintese,
      components: {
        comparativo: buildComparativoComponent(
          // Prefer raw canonical comparativos (nested format) when available; fall back to flat
          (rawComparativos && rawComparativos.length > 0) ? rawComparativos : participacaoPorDisciplina,
          { title: `Comparativo — ${escola.nome_escola}` },
          theme,
        ),
      },
    },
  };
}

function buildResultadosAno(ano, rede, escolas, totalAnos = 1) {
  const resultadosDoAno = (escolas || []).flatMap((escola) =>
    (escola.resultadosPorAno || []).filter((row) => String(row.ano) === String(ano)),
  );
  const escolasDoAno = escolas
    .map((e) => {
      const rows = (e.resultadosPorAno || []).filter((r) => String(r.ano) === String(ano));
      if (rows.length === 0) return null;
      const media = rows.reduce((sum, r) => sum + r.media, 0) / rows.length;
      const participacaoValues = rows
        .map((r) => Number(r.participacao))
        .filter((value) => Number.isFinite(value));
      const participacao = participacaoValues.length > 0
        ? participacaoValues.reduce((sum, value) => sum + value, 0) / participacaoValues.length
        : null;

      return {
        id_escola: e.id_escola,
        nome_escola: e.nome_escola,
        media: roundValue(media),
        participacao: participacao == null ? null : roundValue(participacao),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.media - a.media)
    .map((row, index) => ({
      ...row,
      posicao: index + 1,
    }));

  const mediaRedeValues = resultadosDoAno
    .map((row) => Number(row.media))
    .filter((value) => Number.isFinite(value));
  const participacaoValues = resultadosDoAno
    .map((row) => Number(row.participacao))
    .filter((value) => Number.isFinite(value));

  return {
    section: 'resultados_ano',
    title: `Resultados por Ano/Série — ${ano}`,
    data: {
      chromeSectionLabel: 'Resultados por Ano/Série',
      layoutHeading: 'Resultados por ano/série',
      layoutSubheading: String(ano),
      ano,
      mediaRede: mediaRedeValues.length > 0
        ? roundValue(mediaRedeValues.reduce((sum, value) => sum + value, 0) / mediaRedeValues.length)
        : rede.mediaGeral,
      participacaoMedia: participacaoValues.length > 0
        ? roundValue(participacaoValues.reduce((sum, value) => sum + value, 0) / participacaoValues.length)
        : null,
      distribuicao: totalAnos === 1 ? rede.distribuicao : null,
      escolas: escolasDoAno,
    },
  };
}

function buildMetodologia(metadata, rede) {
  return {
    section: 'metodologia',
    title: 'Metodologia',
    data: {
      chromeSectionLabel: 'Durante a Aplicação',
      layoutHeading: 'Metodologia e cobertura',
      layoutSubheading: metadata.municipio || '',
      totalAlunos: rede.totalAlunos,
      disciplinas: Object.keys(rede.mediasPorDisciplina || {}),
      municipio: metadata.municipio || '',
      ciclo: metadata.ciclo || '',
      ano: metadata.ano || '',
    },
  };
}

function buildProximosPassos(metadata, rede, escolas, disciplinas) {
  const disciplinaComMenorMedia = Object.entries(rede.mediasPorDisciplina || {}).sort(
    (left, right) => left[1].media - right[1].media,
  )[0];
  const escolasAbaixoDaMedia = (escolas || []).filter((escola) => escola.media < rede.mediaGeral).length;
  const recommendationFocus = disciplinaComMenorMedia ? disciplinaComMenorMedia[0] : (disciplinas || [])[0];

  return {
    section: 'proximos_passos',
    title: 'Encaminhamentos Recomendados',
    data: {
      chromeSectionLabel: 'Próximos Passos',
      layoutHeading: 'Encaminhamentos recomendados',
      layoutSubheading: metadata.municipio || '',
      body: `Os resultados do ciclo ${metadata.ciclo || ''} devem orientar o planejamento pedagógico da rede de ${metadata.municipio || ''}. A leitura institucional sugere priorizar ações focalizadas, monitoramento contínuo e devolutivas consistentes para escolas e equipes gestoras.`,
      recommendations: [
        `Priorizar estratégias de recomposição e aprofundamento em ${recommendationFocus || 'disciplinas prioritárias'}.`,
        `${escolasAbaixoDaMedia} escola(s) ficaram abaixo da média geral da rede e demandam acompanhamento mais próximo.`,
        'Usar os achados deste book como referência para pactuar metas, monitorar participação e revisar práticas ao longo do próximo ciclo.',
      ],
    },
  };
}

function buildSchoolOperationalSnapshot(escola, canonicalModel) {
  const escolaEntity = ((canonicalModel.entities || {}).escolas || []).find((item) => item.id === escola.id_escola);
  const participationFact = ((canonicalModel.facts || {}).participacoes || []).find(
    (fact) =>
      fact.scope &&
      fact.scope.type === 'escola' &&
      fact.scope.id === escola.id_escola &&
      !fact.disciplinaId &&
      fact.anoId === 'geral',
  );

  return {
    previstos: escolaEntity && escolaEntity.previstos != null ? escolaEntity.previstos : null,
    iniciaram: escolaEntity && escolaEntity.iniciaram != null ? escolaEntity.iniciaram : null,
    finalizaram:
      escolaEntity && escolaEntity.finalizaram != null ? escolaEntity.finalizaram : escola.totalAlunos || null,
    participacaoTotal:
      participationFact && participationFact.taxaParticipacao != null
        ? participationFact.taxaParticipacao
        : escola.participacao,
  };
}

function buildSchoolComparatives(escola, canonicalModel) {
  return ((((canonicalModel.derived || {}).comparativos || {}).escolaVsRede || []).filter(
    (comparativo) => comparativo.escolaId === escola.id_escola,
  ));
}

function buildSchoolSummary(escola, rede, operacional, comparativos, rankingPosition) {
  const rankingText = rankingPosition
    ? `${escola.nome_escola} ocupa a ${rankingPosition}ª posição no ranking geral da rede.`
    : `${escola.nome_escola} integra o conjunto de escolas analisadas neste ciclo.`;
  const participationText =
    operacional.participacaoTotal != null
      ? `A participação total foi de ${operacional.participacaoTotal}%, com ${operacional.finalizaram || escola.totalAlunos} estudantes finalizando a avaliação.`
      : `A escola registrou ${escola.totalAlunos} estudantes avaliados no período.`;
  const mediaDirection = escola.media >= rede.mediaGeral ? 'acima' : 'abaixo';
  const destaque = [...(comparativos || [])]
    .filter((comparativo) => comparativo.deltaMedia != null)
    .sort((left, right) => right.deltaMedia - left.deltaMedia)[0];
  const destaqueText = destaque
    ? `Entre os recortes comparáveis, o melhor desempenho relativo aparece em ${destaque.disciplina}, com diferença de ${formatSignedNumber(destaque.deltaMedia)} ponto(s) em relação à média da rede.`
    : '';

  return [rankingText, participationText, `A média geral da escola está ${mediaDirection} da média da rede (${escola.media} vs ${rede.mediaGeral}).`, destaqueText]
    .filter(Boolean)
    .join(' ');
}

// ─── Habilidades page builders ────────────────────────────────────────────────

const HABILIDADES_MAX_ROWS_PER_PAGE = 20;

/**
 * Builds habilidades pages by joining entities.habilidades with
 * facts.desempenhosHabilidade and grouping by discipline.
 * Returns an empty array when there are no habilidades in the model.
 */
function buildHabilidadesPages(entities, facts, disciplinas, theme) {
  const habilidades = ((entities || {}).habilidades) || [];
  if (habilidades.length === 0) return [];

  const desempenhos = ((facts || {}).desempenhosHabilidade) || [];
  const disciplinaLookup = new Map(
    ((entities || {}).disciplinas || []).map((d) => [d.id, d.nome]),
  );

  // Build performance index by habilidadeId
  const desempenhoMap = new Map();
  desempenhos.forEach((d) => desempenhoMap.set(d.habilidadeId, d));

  // Enrich each habilidade with performance data
  const enriched = habilidades.map((h) => {
    const perf = desempenhoMap.get(h.id);
    return {
      ...h,
      percentualAcerto: perf ? perf.desempenhoPercentual : null,
    };
  });

  // Group by discipline name (fall back to 'Geral' when unknown)
  const byDisciplina = new Map();
  enriched.forEach((h) => {
    const disciplinaNome = h.disciplinaId
      ? (disciplinaLookup.get(h.disciplinaId) || h.disciplinaId)
      : 'Geral';
    if (!byDisciplina.has(disciplinaNome)) byDisciplina.set(disciplinaNome, []);
    byDisciplina.get(disciplinaNome).push(h);
  });

  const pages = [];

  for (const [disciplina, rows] of byDisciplina.entries()) {
    const tableComponent = buildHabilidadesTable(
      rows,
      {
        title: `Habilidades — ${disciplina}`,
        columns: ['codigo', 'descricao', 'percentualAcerto'],
        maxRowsPerPage: HABILIDADES_MAX_ROWS_PER_PAGE,
      },
      theme,
    );
    const totalPages = tableComponent.totalPages;
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageRows = tableComponent.pages[pageIdx] || [];
      pages.push(buildHabilidadesPage(disciplina, pageRows, rows.length, pageIdx, totalPages, tableComponent, theme));
    }
  }

  return pages;
}

function buildHabilidadesPage(disciplina, rows, totalHabilidades, pageIndex, totalPages, tableComponent, theme) {
  const suffix = totalPages > 1 ? ` (${pageIndex + 1}/${totalPages})` : '';
  const tabela =
    tableComponent ||
    buildHabilidadesTable(
      rows,
      {
        title: `Habilidades — ${disciplina}`,
        columns: ['codigo', 'descricao', 'percentualAcerto'],
        maxRowsPerPage: HABILIDADES_MAX_ROWS_PER_PAGE,
      },
      theme,
    );

  return {
    section: 'habilidades_disciplina',
    title: `Habilidades — ${disciplina}${suffix}`,
    data: {
      chromeSectionLabel: 'Resultados por Habilidade',
      layoutHeading: `Habilidades em ${disciplina}`,
      layoutSubheading: totalPages > 1 ? `Página ${pageIndex + 1} de ${totalPages}` : 'Painel consolidado',
      disciplina,
      rows,
      totalHabilidades,
      pageIndex,
      totalPages,
      components: {
        tabela,
      },
    },
  };
}

function resolveEditorialLayout(page = {}, designManifest) {
  const section = page.section || 'generic';
  const data = page.data || {};
  const base = EDITORIAL_LAYOUT_BY_SECTION[section] || DEFAULT_EDITORIAL_LAYOUT;
  const manifestLayout = resolveManifestSectionLayout(section, designManifest);

  return {
    templateId: (manifestLayout && manifestLayout.templateId) || base.templateId,
    variant: resolveLayoutVariant(section, data, base.variant),
    shellRef: (manifestLayout && manifestLayout.shellRef) || (base.shellRef || null),
    frameId: manifestLayout && Object.prototype.hasOwnProperty.call(manifestLayout, 'frameId')
      ? manifestLayout.frameId
      : (base.frameId || null),
    chromeMode: manifestLayout && Object.prototype.hasOwnProperty.call(manifestLayout, 'chromeMode')
      ? manifestLayout.chromeMode
      : (base.chromeMode || null),
    styleRef: (manifestLayout && manifestLayout.styleRef) || null,
    layoutSource: (manifestLayout && manifestLayout.layoutSource) || 'hardcoded',
    sectionGroup: base.sectionGroup,
    density: base.density,
    breakPolicy: base.breakPolicy,
    reviewPriority: base.reviewPriority,
    baselineSection: section,
    chapterKey: data.chapterKey || null,
    disciplina: data.disciplina || null,
    ano: data.ano || null,
    escola: data.nome_escola || null,
  };
}

function resolveLayoutVariant(section, data, fallbackVariant) {
  if (section === 'capitulo' && data.chapterKey) {
    return `chapter-${normalizeLayoutSlug(data.chapterKey)}`;
  }

  if (section === 'resultados_disciplina' && data.disciplina) {
    return `discipline-${normalizeLayoutSlug(data.disciplina)}`;
  }

  if (section === 'resultados_ano' && data.ano) {
    return `year-${normalizeLayoutSlug(data.ano)}`;
  }

  if ((section === 'escola' || section === 'escola_disciplinas') && data.nome_escola) {
    return `${fallbackVariant}-${normalizeLayoutSlug(data.nome_escola)}`;
  }

  return fallbackVariant;
}

function normalizeLayoutSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatSignedNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function roundValue(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
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

module.exports = { render, resolveEditorialLayout };
