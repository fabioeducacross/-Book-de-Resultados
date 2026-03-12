'use strict';

/**
 * Tests for the Renderer module — Book de Resultados
 */

const { render, resolveEditorialLayout } = require('../../packages/book-de-resultados/src/renderer');
const { loadDefaultDesignManifest } = require('../../packages/book-de-resultados/src/design-manifest');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMetrics(overrides = {}) {
  return {
    metadata: { municipio: 'Canoas', ano: 2025, ciclo: '2025-sem1', data: '2025-06-01' },
    rede: {
      totalEscolas: 2,
      totalAlunos: 73,
      participacaoMedia: 89.0,
      mediaGeral: 246.3,
      distribuicao: {
        abaixo_do_basico: 7,
        basico: 17,
        adequado: 35,
        avancado: 13,
        total: 72,
        percentuais: { abaixo_do_basico: 9.7, basico: 23.6, adequado: 48.6, avancado: 18.1 },
      },
      mediasPorDisciplina: {
        Matemática: { media: 250, participacao: 90 },
        Português: { media: 242.5, participacao: 88 },
      },
    },
    escolas: [
      {
        id_escola: '1',
        nome_escola: 'Escola Alpha',
        rankingPosition: 1,
        media: 257.5,
        participacao: 91.5,
        totalAlunos: 37,
        distribuicao: {
          abaixo_do_basico: 2,
          basico: 5,
          adequado: 20,
          avancado: 10,
          total: 37,
          percentuais: { abaixo_do_basico: 5.4, basico: 13.5, adequado: 54.1, avancado: 27 },
        },
        resultadosPorAno: [
          { ano: '5', disciplina: 'Matemática', media: 260, participacao: 92 },
          { ano: '5', disciplina: 'Português', media: 255, participacao: 91 },
        ],
      },
    ],
    rankings: {
      Matemática: [
        { id_escola: '1', nome_escola: 'Escola Alpha', media: 260, participacao: 92, posicao: 1 },
        { id_escola: '2', nome_escola: 'Escola Beta', media: 240, participacao: 88, posicao: 2 },
      ],
    },
    paginatedRankings: {
      Matemática: [
        [
          { id_escola: '1', nome_escola: 'Escola Alpha', media: 260, participacao: 92, posicao: 1 },
          { id_escola: '2', nome_escola: 'Escola Beta', media: 240, participacao: 88, posicao: 2 },
        ],
      ],
    },
    entities: {
      escolas: [
        {
          id: '1',
          redeId: 'rede-canoas',
          nome: 'Escola Alpha',
          previstos: 40,
          iniciaram: 38,
          finalizaram: 37,
          participacaoTotal: 91.5,
        },
      ],
    },
    facts: {
      participacoes: [
        {
          scope: { type: 'escola', id: '1' },
          disciplinaId: null,
          anoId: 'geral',
          taxaParticipacao: 91.5,
          previstos: 40,
          iniciaram: 38,
          finalizaram: 37,
        },
      ],
    },
    derived: {
      comparativos: {
        escolaVsRede: [
          {
            escolaId: '1',
            disciplina: 'Matemática',
            escola: { media: 260, taxaParticipacao: 92 },
            rede: { media: 250, taxaParticipacao: 90 },
            delta: { media: 10, taxaParticipacao: 2 },
          },
          {
            escolaId: '1',
            disciplina: 'Português',
            escola: { media: 255, taxaParticipacao: 91 },
            rede: { media: 242.5, taxaParticipacao: 88 },
            delta: { media: 12.5, taxaParticipacao: 3 },
          },
        ],
      },
    },
    disciplinas: ['Matemática', 'Português'],
    anos: ['5'],
    totalEscolas: 2,
    ...overrides,
  };
}

// ─── render() ─────────────────────────────────────────────────────────────────

describe('render()', () => {
  let pages;

  beforeEach(() => {
    pages = render(makeMetrics(), { designManifest: loadDefaultDesignManifest() });
  });

  test('returns an array of page objects', () => {
    expect(Array.isArray(pages)).toBe(true);
    expect(pages.length).toBeGreaterThan(0);
  });

  test('assigns sequential page numbers starting from 1', () => {
    pages.forEach((page, idx) => {
      expect(page.pageNumber).toBe(idx + 1);
    });
  });

  test('first page is the capa', () => {
    expect(pages[0].section).toBe('capa');
  });

  test('contains a sumario page', () => {
    const sumario = pages.find((p) => p.section === 'sumario');
    expect(sumario).toBeDefined();
  });

  test('includes the editorial chapter pages in the expected order', () => {
    const chapterPages = pages.filter((p) => p.section === 'capitulo');
    expect(chapterPages.map((page) => page.data.chapterKey)).toEqual([
      'antes',
      'durante',
      'resultados',
      'proximos_passos',
    ]);
  });

  test('sumario entries have page numbers and titles', () => {
    const sumario = pages.find((p) => p.section === 'sumario');
    expect(sumario.data.entries.length).toBeGreaterThan(0);
    sumario.data.entries.forEach((entry) => {
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('page');
      expect(typeof entry.page).toBe('number');
    });
  });

  test('sumario includes the new editorial chapter titles', () => {
    const sumario = pages.find((p) => p.section === 'sumario');
    const titles = sumario.data.entries.map((entry) => entry.title);

    expect(titles).toEqual(
      expect.arrayContaining([
        'Antes da Avaliação',
        'Durante a Aplicação',
        'Resultados',
        'Próximos Passos',
      ]),
    );
  });

  test('contains visao_geral page', () => {
    const pg = pages.find((p) => p.section === 'visao_geral');
    expect(pg).toBeDefined();
    expect(pg.data.totalEscolas).toBe(2);
  });

  test('annotates pages with a declarative editorial layout contract', () => {
    const habilidadesPages = render(makeMetricsWithHabilidades(), { designManifest: loadDefaultDesignManifest() });
    const cover = pages.find((p) => p.section === 'capa');
    const chapter = pages.find((p) => p.section === 'capitulo');
    const participacao = pages.find((p) => p.section === 'participacao_rede');
    const participacaoTabela = pages.find((p) => p.section === 'participacao_rede_tabela');
    const overview = pages.find((p) => p.section === 'visao_geral');
    const disciplina = pages.find((p) => p.section === 'resultados_disciplina');
    const escola = pages.find((p) => p.section === 'escola');
    const escolaComparativa = pages.find((p) => p.section === 'escola_disciplinas');
    const ranking = pages.find((p) => p.section === 'ranking');
    const habilidades = habilidadesPages.find((p) => p.section === 'habilidades_disciplina');

    expect(cover.layout).toMatchObject({
      templateId: 'cover-page',
      variant: 'institutional-cover',
      shellRef: 'cover-slab',
      sectionGroup: 'editorial',
      reviewPriority: 'primary',
    });
    expect(chapter.layout).toMatchObject({
      templateId: 'chapter-opener',
      variant: 'chapter-antes',
      shellRef: 'chapter-hero-shell',
      sectionGroup: 'editorial',
      reviewPriority: 'primary',
    });
    expect(participacao.layout).toMatchObject({
      templateId: 'editorial-body',
      shellRef: 'editorial-split-shell',
      styleRef: 'editorial-split',
      chromeMode: 'none',
      layoutSource: 'manifest',
    });
    expect(participacaoTabela.layout).toMatchObject({
      templateId: 'editorial-table',
      shellRef: 'editorial-table-shell',
      styleRef: 'editorial-table',
      chromeMode: 'none',
      layoutSource: 'manifest',
    });
    expect(overview.layout).toMatchObject({
      templateId: 'network-overview',
      variant: 'overview',
      shellRef: 'network-overview-shell',
      styleRef: 'analytic-overview',
      layoutSource: 'manifest',
      density: 'balanced',
      reviewPriority: 'primary',
    });
    expect(disciplina.layout).toMatchObject({
      templateId: 'discipline-results',
      variant: expect.stringMatching(/^discipline-/),
      styleRef: 'analytic-discipline',
      layoutSource: 'manifest',
      sectionGroup: 'analitico',
      reviewPriority: 'primary',
    });
    expect(escola.layout).toMatchObject({
      templateId: 'school-overview',
      shellRef: 'school-summary-shell',
      styleRef: 'school-summary',
      layoutSource: 'manifest',
      frameId: 'school-frame',
      chromeMode: 'framed',
    });
    expect(escolaComparativa.layout).toMatchObject({
      templateId: 'school-comparison',
      shellRef: 'school-comparison-shell',
      styleRef: 'school-comparison',
      layoutSource: 'manifest',
      frameId: 'school-frame',
      chromeMode: 'framed',
    });
    expect(ranking.layout).toMatchObject({
      templateId: 'ranking-table',
      shellRef: 'dense-table-shell',
      styleRef: 'dense-table',
      layoutSource: 'manifest',
      frameId: 'ranking-frame',
      chromeMode: 'framed',
    });
    expect(habilidades.layout).toMatchObject({
      templateId: 'skills-table',
      variant: 'skills',
      shellRef: 'dense-table-shell',
      styleRef: 'dense-table',
      layoutSource: 'manifest',
      frameId: 'skills-frame',
      chromeMode: 'framed',
      reviewPriority: 'secondary',
    });
  });

  test('generates one resultados_disciplina page per discipline', () => {
    const disciplinaPages = pages.filter((p) => p.section === 'resultados_disciplina');
    expect(disciplinaPages.length).toBe(2); // Matemática + Português
  });

  test('generates ranking pages', () => {
    const rankingPages = pages.filter((p) => p.section === 'ranking');
    expect(rankingPages.length).toBeGreaterThan(0);
  });

  test('generates one escola page per escola', () => {
    const escolaPages = pages.filter((p) => p.section === 'escola');
    expect(escolaPages).toHaveLength(1);
    expect(escolaPages[0].data.nome_escola).toBe('Escola Alpha');
  });

  test('generates one comparative school page per escola', () => {
    const escolaPages = pages.filter((p) => p.section === 'escola_disciplinas');
    expect(escolaPages).toHaveLength(1);
    expect(escolaPages[0].data.nome_escola).toBe('Escola Alpha');
  });

  test('generates resultados_ano pages', () => {
    const anoPages = pages.filter((p) => p.section === 'resultados_ano');
    expect(anoPages).toHaveLength(1); // ano '5'
  });

  test('resultados_ano page carries year-specific school ranking data', () => {
    const metrics = makeMetrics({
      escolas: [
        ...makeMetrics().escolas,
        {
          id_escola: '2',
          nome_escola: 'Escola Beta',
          rankingPosition: 2,
          media: 195,
          participacao: 75,
          totalAlunos: 22,
          distribuicao: {
            abaixo_do_basico: 5,
            basico: 8,
            adequado: 6,
            avancado: 3,
            total: 22,
            percentuais: { abaixo_do_basico: 22.7, basico: 36.4, adequado: 27.3, avancado: 13.6 },
          },
          resultadosPorAno: [
            { ano: '5', disciplina: 'Matemática', media: 200, participacao: 80 },
            { ano: '5', disciplina: 'Português', media: 190, participacao: 70 },
          ],
        },
      ],
    });

    const anoPage = render(metrics).find((p) => p.section === 'resultados_ano');

    expect(anoPage.data.mediaRede).toBe(226.3);
    expect(anoPage.data.escolas).toEqual([
      expect.objectContaining({ nome_escola: 'Escola Alpha', posicao: 1, media: 257.5, participacao: 91.5 }),
      expect.objectContaining({ nome_escola: 'Escola Beta', posicao: 2, media: 195, participacao: 75 }),
    ]);
  });

  test('contains the new narrative pages for context, participation and next steps', () => {
    expect(pages.find((p) => p.section === 'contexto_avaliacao')).toBeDefined();
    expect(pages.find((p) => p.section === 'participacao_rede')).toBeDefined();
    expect(pages.find((p) => p.section === 'proximos_passos')).toBeDefined();
  });

  test('adds editorial participation tables after the participation opener', () => {
    const aberturaParticipacaoIndex = pages.findIndex((p) => p.section === 'participacao_rede');
    const tabelaParticipacaoPages = pages.filter((p) => p.section === 'participacao_rede_tabela');
    const primeiraTabelaIndex = pages.findIndex((p) => p.section === 'participacao_rede_tabela');

    expect(tabelaParticipacaoPages.length).toBeGreaterThan(0);
    expect(aberturaParticipacaoIndex).toBeLessThan(primeiraTabelaIndex);
    expect(tabelaParticipacaoPages).toHaveLength(2);
    expect(tabelaParticipacaoPages[0].data.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'nomeEscola', label: 'Escola' }),
        expect.objectContaining({ key: 'total', label: 'Total' }),
      ]),
    );
    expect(tabelaParticipacaoPages.map((page) => page.data.discipline)).toEqual(['Matemática', 'Português']);
  });

  test('keeps the participation opener focused on operational participation reading', () => {
    const participacao = pages.find((p) => p.section === 'participacao_rede');

    expect(participacao.data.body).toContain('Como é comum em avaliações educacionais');
    expect(participacao.data.body).not.toContain('Matemática: média');
    expect(participacao.data.disciplinasAvaliadas).toBe(2);
  });

  test('keeps metodologia inside the editorial flow', () => {
    const metodologia = pages.find((p) => p.section === 'metodologia');
    expect(metodologia).toBeDefined();
    const duringChapterIndex = pages.findIndex((p) => p.section === 'capitulo' && p.data.chapterKey === 'durante');
    const metodologiaIndex = pages.findIndex((p) => p.section === 'metodologia');
    const resultadosChapterIndex = pages.findIndex((p) => p.section === 'capitulo' && p.data.chapterKey === 'resultados');

    expect(duringChapterIndex).toBeLessThan(metodologiaIndex);
    expect(metodologiaIndex).toBeLessThan(resultadosChapterIndex);
  });

  test('accepts optional editorial assets for chapter and participation openers', () => {
    const pagesWithAssets = render(makeMetrics(), {
      editorialAssets: {
        chapterResultadosImageUrl: 'C:/tmp/chapter-resultados.png',
        chapterResultadosOverlayImageUrl: 'C:/tmp/chapter-resultados-overlay.png',
        participacaoImageUrl: 'C:/tmp/participacao.jpg',
      },
    });

    const resultadosChapter = pagesWithAssets.find(
      (page) => page.section === 'capitulo' && page.data.chapterKey === 'resultados',
    );
    const participacaoPage = pagesWithAssets.find((page) => page.section === 'participacao_rede');

    expect(resultadosChapter.data.imageUrl).toBe('C:/tmp/chapter-resultados.png');
    expect(resultadosChapter.data.overlayImageUrl).toBe('C:/tmp/chapter-resultados-overlay.png');
    expect(participacaoPage.data.imageUrl).toBe('C:/tmp/participacao.jpg');
  });

  test('capa page has municipio and ano from metadata', () => {
    const capa = pages.find((p) => p.section === 'capa');
    expect(capa.data.municipio).toBe('Canoas');
    expect(capa.data.ano).toBe(2025);
  });

  test('escola page carries mediaRede', () => {
    const escolaPage = pages.find((p) => p.section === 'escola');
    expect(escolaPage.data.mediaRede).toBe(246.3);
  });

  test('escola page carries rankingPosition when available', () => {
    const escolaPage = pages.find((p) => p.section === 'escola');
    expect(escolaPage.data.rankingPosition).toBe(1);
  });

  test('escola_disciplinas page also carries rankingPosition when available', () => {
    const escolaComparativa = pages.find((p) => p.section === 'escola_disciplinas');
    expect(escolaComparativa.data.rankingPosition).toBe(1);
  });

  test('escola page exposes operational cards data from the canonical model', () => {
    const escolaPage = pages.find((p) => p.section === 'escola');
    expect(escolaPage.data.operacional).toMatchObject({
      previstos: 40,
      iniciaram: 38,
      finalizaram: 37,
      participacaoTotal: 91.5,
    });
  });

  test('escola page includes discipline comparisons for participation and media', () => {
    const escolaPage = pages.find((p) => p.section === 'escola_disciplinas');
    expect(escolaPage.data.participacaoPorDisciplina).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          disciplina: 'Matemática',
          participacaoEscola: 92,
          participacaoRede: 90,
          mediaEscola: 260,
          mediaRede: 250,
          deltaMedia: 10,
        }),
      ]),
    );
  });

  test('escola page includes a generated synthesis paragraph', () => {
    const escolaPage = pages.find((p) => p.section === 'escola');
    expect(escolaPage.data.sintese).toContain('Escola Alpha');
    expect(escolaPage.data.sintese).toContain('91.5%');
  });
});

describe('resolveEditorialLayout()', () => {
  test('derives section-specific variants from page data', () => {
    expect(resolveEditorialLayout({
      section: 'resultados_ano',
      data: { ano: '5' },
    })).toMatchObject({
      templateId: 'year-results',
      variant: 'year-5',
      sectionGroup: 'analitico',
    });

    expect(resolveEditorialLayout({
      section: 'escola',
      data: { nome_escola: 'EMEF Escola Alfa' },
    })).toMatchObject({
      templateId: 'school-overview',
      variant: 'school-summary-emef-escola-alfa',
      escola: 'EMEF Escola Alfa',
    });
  });

  test('applies manifest layout as an overlay and keeps hardcoded fallbacks', () => {
    const layout = resolveEditorialLayout(
      {
        section: 'resultados_disciplina',
        data: { disciplina: 'Matemática' },
      },
      {
        sections: {
          resultados_disciplina: { template: 'discipline-results' },
        },
        templates: {
          'discipline-results': {
            styleRef: 'analytic-discipline',
            chromeMode: 'framed',
            frameId: 'discipline-frame',
          },
        },
      },
    );

    expect(layout).toMatchObject({
      templateId: 'discipline-results',
      variant: 'discipline-matematica',
      styleRef: 'analytic-discipline',
      layoutSource: 'manifest',
      frameId: 'discipline-frame',
      chromeMode: 'framed',
      sectionGroup: 'analitico',
      reviewPriority: 'primary',
    });
  });
});

// ─── render() — component descriptors ────────────────────────────────────────

describe('render() — component descriptors attached to pages', () => {
  let pages;

  beforeEach(() => {
    pages = render(makeMetrics(), { designManifest: loadDefaultDesignManifest() });
  });

  test('escola page has components.proficiencia of type "proficiencia"', () => {
    const escolaPage = pages.find((p) => p.section === 'escola');
    expect(escolaPage.data.components).toBeDefined();
    expect(escolaPage.data.components.proficiencia).toBeDefined();
    expect(escolaPage.data.components.proficiencia.type).toBe('proficiencia');
  });

  test('escola proficiencia component has 4 bars', () => {
    const escolaPage = pages.find((p) => p.section === 'escola');
    expect(escolaPage.data.components.proficiencia.bars).toHaveLength(4);
  });

  test('escola_disciplinas page has components.comparativo of type "comparativo"', () => {
    const comparPage = pages.find((p) => p.section === 'escola_disciplinas');
    expect(comparPage.data.components).toBeDefined();
    expect(comparPage.data.components.comparativo).toBeDefined();
    expect(comparPage.data.components.comparativo.type).toBe('comparativo');
  });

  test('escola_disciplinas comparativo rows include Matemática and Português', () => {
    const comparPage = pages.find((p) => p.section === 'escola_disciplinas');
    const disciplinas = comparPage.data.components.comparativo.rows.map((r) => r.disciplina);
    expect(disciplinas).toContain('Matemática');
    expect(disciplinas).toContain('Português');
  });

  test('visao_geral page has components.proficiencia', () => {
    const pg = pages.find((p) => p.section === 'visao_geral');
    expect(pg.data.components).toBeDefined();
    expect(pg.data.components.proficiencia).toBeDefined();
    expect(pg.data.components.proficiencia.type).toBe('proficiencia');
  });

  test('resultados_disciplina page has components.proficiencia', () => {
    const pg = pages.find((p) => p.section === 'resultados_disciplina');
    expect(pg.data.components).toBeDefined();
    expect(pg.data.components.proficiencia.type).toBe('proficiencia');
  });

  test('comparativo rows have delta with color and formatted value', () => {
    const comparPage = pages.find((p) => p.section === 'escola_disciplinas');
    const mat = comparPage.data.components.comparativo.rows.find((r) => r.disciplina === 'Matemática');
    expect(mat.delta.mediaFormatted).toBe('+10');
    expect(mat.delta.mediaColor).toBeTruthy(); // should be deltaPositive color
  });

  test('proficiencia component total matches escola distribuicao total', () => {
    const escolaPage = pages.find((p) => p.section === 'escola');
    expect(escolaPage.data.components.proficiencia.total).toBe(escolaPage.data.distribuicao.total);
  });
});

// ─── render() — habilidades pages ────────────────────────────────────────────

describe('render() — habilidades pages', () => {
  test('no habilidades_disciplina pages when entities.habilidades is absent', () => {
    const pages = render(makeMetrics());
    const habPages = pages.filter((p) => p.section === 'habilidades_disciplina');
    expect(habPages).toHaveLength(0);
  });

  test('no habilidades_disciplina pages when entities.habilidades is empty', () => {
    const metrics = makeMetrics({
      entities: { escolas: makeMetrics().entities.escolas, habilidades: [] },
    });
    const pages = render(metrics);
    const habPages = pages.filter((p) => p.section === 'habilidades_disciplina');
    expect(habPages).toHaveLength(0);
  });

  test('generates one habilidades_disciplina page per discipline group', () => {
    const metrics = makeMetricsWithHabilidades();
    const pages = render(metrics);
    const habPages = pages.filter((p) => p.section === 'habilidades_disciplina');
    // Fixture has 2 disciplines: Matemática (1 habilidade) + Português (1 habilidade)
    expect(habPages.length).toBeGreaterThanOrEqual(1);
  });

  test('habilidades pages have components.tabela of type "habilidades_table"', () => {
    const pages = render(makeMetricsWithHabilidades());
    const habPage = pages.find((p) => p.section === 'habilidades_disciplina');
    expect(habPage).toBeDefined();
    expect(habPage.data.components.tabela.type).toBe('habilidades_table');
  });

  test('habilidades pages include rows enriched with percentualAcerto', () => {
    const pages = render(makeMetricsWithHabilidades());
    const habPage = pages.find((p) => p.section === 'habilidades_disciplina');
    // At least one row should have percentualAcerto from facts
    const rowWithPerf = habPage.data.rows.find((r) => r.percentualAcerto != null);
    expect(rowWithPerf).toBeDefined();
  });

  test('habilidades pages are placed inside the resultados chapter', () => {
    const pages = render(makeMetricsWithHabilidades());
    const resultadosChapterIdx = pages.findIndex(
      (p) => p.section === 'capitulo' && p.data.chapterKey === 'resultados',
    );
    const proximosPassosChapterIdx = pages.findIndex(
      (p) => p.section === 'capitulo' && p.data.chapterKey === 'proximos_passos',
    );
    const habIdx = pages.findIndex((p) => p.section === 'habilidades_disciplina');
    expect(habIdx).toBeGreaterThan(resultadosChapterIdx);
    expect(habIdx).toBeLessThan(proximosPassosChapterIdx);
  });

  test('paginated habilidades: multiple pages when habilidades exceed maxRowsPerPage', () => {
    const manyHabilidades = Array.from({ length: 25 }, (_, i) => ({
      codigo_habilidade: `MT${i + 1}`,
      habilidade: `Habilidade ${i + 1}`,
      area_conhecimento: 'Matemática',
      ano_escolar: '5',
      desempenho_percentual: 60,
    }));

    const metrics = makeMetrics({
      entities: {
        escolas: makeMetrics().entities.escolas,
        habilidades: manyHabilidades.map((h, i) => ({
          id: `mat|5|mt${i + 1}`,
          codigo: h.codigo_habilidade,
          descricao: h.habilidade,
          disciplinaId: 'matematica',
          anoId: '5',
        })),
        disciplinas: [{ id: 'matematica', nome: 'Matemática' }],
        areas: [],
        anos: [],
      },
      facts: {
        participacoes: makeMetrics().facts.participacoes,
        desempenhosHabilidade: manyHabilidades.map((_, i) => ({
          habilidadeId: `mat|5|mt${i + 1}`,
          desempenhoPercentual: 60,
        })),
      },
    });

    const pages = render(metrics);
    const habPages = pages.filter((p) => p.section === 'habilidades_disciplina');
    // 25 habilidades / 20 per page = 2 pages
    expect(habPages.length).toBe(2);
    expect(habPages[0].data.pageIndex).toBe(0);
    expect(habPages[1].data.pageIndex).toBe(1);
    expect(habPages[0].data.components.tabela.totalPages).toBe(2);
    expect(habPages[0].data.components.tabela.totalRows).toBe(25);
    expect(habPages[1].data.components.tabela.totalPages).toBe(2);
    expect(habPages[1].data.components.tabela.totalRows).toBe(25);
  });
});

// ─── render() — theme option ──────────────────────────────────────────────────

describe('render() — theme option', () => {
  test('accepts a theme override without breaking', () => {
    const pages = render(makeMetrics(), { theme: { colors: { primary: '#003399' } } });
    expect(Array.isArray(pages)).toBe(true);
    expect(pages.length).toBeGreaterThan(0);
  });

  test('theme colors flow into proficiencia component', () => {
    const customColor = '#336600';
    const pages = render(makeMetrics(), {
      theme: { colors: { proficiency: { adequado: customColor } } },
    });
    const escolaPage = pages.find((p) => p.section === 'escola');
    const adequadoBar = escolaPage.data.components.proficiencia.bars.find(
      (b) => b.nivel === 'adequado',
    );
    expect(adequadoBar.color).toBe(customColor);
  });
});

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeMetricsWithHabilidades() {
  return makeMetrics({
    entities: {
      escolas: makeMetrics().entities.escolas,
      habilidades: [
        { id: 'mat|5|mt01', codigo: 'MT01', descricao: 'Resolver frações', disciplinaId: 'matematica', anoId: '5' },
        { id: 'por|5|lp01', codigo: 'LP01', descricao: 'Interpretar textos', disciplinaId: 'portugues', anoId: '5' },
      ],
      disciplinas: [
        { id: 'matematica', nome: 'Matemática' },
        { id: 'portugues', nome: 'Português' },
      ],
      areas: [],
      anos: [],
    },
    facts: {
      participacoes: makeMetrics().facts.participacoes,
      desempenhosHabilidade: [
        { habilidadeId: 'mat|5|mt01', desempenhoPercentual: 65.5 },
        { habilidadeId: 'por|5|lp01', desempenhoPercentual: 48.0 },
      ],
    },
  });
}

// ─── render() — with multiple paginated rankings ──────────────────────────────

describe('render() — paginated rankings', () => {
  test('generates multiple ranking pages when paginatedRankings has multiple pages', () => {
    const rows25 = Array.from({ length: 25 }, (_, i) => ({
      id_escola: String(i + 1),
      nome_escola: `Escola ${i + 1}`,
      media: 300 - i,
      participacao: 90,
      posicao: i + 1,
    }));

    const metrics = makeMetrics({
      paginatedRankings: { Matemática: [rows25, rows25.slice(0, 5)] },
    });

    const pages = render(metrics);
    const rankingPages = pages.filter((p) => p.section === 'ranking');
    expect(rankingPages.length).toBe(2);
  });
});
