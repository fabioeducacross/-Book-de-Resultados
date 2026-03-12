'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

const { execFile } = require('child_process');
const {
  buildIndicatorCard,
  buildRankingChart,
  buildComparativoChart,
} = require('../../packages/book-de-resultados/src/charts');
const {
  exportPdf,
  resolvePdfBrowserPath,
} = require('../../packages/book-de-resultados/src/exporter');
const { buildHtmlDocument } = require('../../packages/book-de-resultados/src/html-renderer');
const { resolveEditorialLayout } = require('../../packages/book-de-resultados/src/renderer');
const {
  buildProficienciaComponent,
  buildComparativoComponent,
  buildHabilidadesTable,
} = require('../../packages/book-de-resultados/src/components');
const { generateBook } = require('../../packages/book-de-resultados/src');
const { loadDefaultDesignManifest } = require('../../packages/book-de-resultados/src/design-manifest');

function makePdfPages() {
  return [
    {
      section: 'capa',
      title: 'Capa',
      pageNumber: 1,
      data: {
        municipio: 'Canoas',
        ano: '2025',
        ciclo: '2025-sem1',
      },
    },
    {
      section: 'capitulo',
      title: 'Resultados',
      pageNumber: 2,
      data: {
        chapterIndex: 1,
        chapterDisplayIndex: 2,
        chapterKey: 'resultados',
        chapterTitle: 'Resultados',
        summary: 'Leitura analítica da rede, dos recortes disciplinares, dos anos e das escolas.',
      },
    },
    {
      section: 'visao_geral',
      title: 'Visão Geral da Rede',
      pageNumber: 3,
      data: {
        totalEscolas: 2,
        totalAlunos: 73,
        participacaoMedia: 89,
        mediaGeral: 246.3,
        distribuicao: {
          abaixo_do_basico: 7,
          basico: 17,
          adequado: 35,
          avancado: 13,
          total: 72,
          percentuais: { abaixo_do_basico: 9.7, basico: 23.6, adequado: 48.6, avancado: 18.1 },
        },
        components: {
          proficiencia: buildProficienciaComponent({
            abaixo_do_basico: 7,
            basico: 17,
            adequado: 35,
            avancado: 13,
            total: 72,
            percentuais: { abaixo_do_basico: 9.7, basico: 23.6, adequado: 48.6, avancado: 18.1 },
          }),
        },
      },
    },
    {
      section: 'participacao_rede_tabela',
      title: 'Participação por escola',
      pageNumber: 4,
      data: {
        tableTitle: 'Número de Alunos por Escola que fizeram a Prova de Matemática',
        disciplineKey: 'matematica',
        columns: [
          { key: 'nomeEscola', label: 'Escola', type: 'text' },
          { key: 'total', label: 'Total', type: 'integer', numeric: true },
        ],
        rows: [
          { nomeEscola: 'Escola Alpha', total: 37 },
          { nomeEscola: 'Escola Beta', total: 36 },
        ],
      },
    },
    {
      section: 'escola_disciplinas',
      title: 'Escola Alpha — Participação por Área',
      pageNumber: 5,
      data: {
        nome_escola: 'Escola Alpha',
        rankingPosition: 1,
        sintese: 'Síntese automática.',
        participacaoPorDisciplina: [
          {
            disciplina: 'Matemática',
            participacaoEscola: 92,
            participacaoRede: 90,
            mediaEscola: 260,
            mediaRede: 250,
            deltaMedia: 10,
          },
        ],
        components: {
          comparativo: buildComparativoComponent([
            {
              disciplina: 'Matemática',
              mediaEscola: 260,
              mediaRede: 250,
              deltaMedia: 10,
              participacaoEscola: 92,
              participacaoRede: 90,
            },
          ]),
        },
      },
    },
    {
      section: 'habilidades_disciplina',
      title: 'Habilidades — Matemática',
      pageNumber: 6,
      data: {
        disciplina: 'Matemática',
        pageIndex: 0,
        rows: [
          { codigo: 'MAT5A1', descricao: 'Resolver problema', percentualAcerto: 82.4 },
        ],
        components: {
          tabela: buildHabilidadesTable(
            [{ codigo: 'MAT5A1', descricao: 'Resolver problema', percentualAcerto: 82.4 }],
            { title: 'Habilidades — Matemática', columns: ['codigo', 'descricao', 'percentualAcerto'] },
          ),
        },
      },
    },
  ];
}

function makeChartsPerPage() {
  return [
    [],
    [],
    [
      buildIndicatorCard('Total de Escolas', 2),
      buildIndicatorCard('Total de Estudantes', 73),
      buildIndicatorCard('Participação Média', '89%'),
      buildIndicatorCard('Média Geral', 246.3),
    ],
    [
      buildIndicatorCard('Posição Geral', '1º'),
      buildComparativoChart([
        {
          disciplina: 'Matemática',
          mediaEscola: 260,
          mediaRede: 250,
          deltaMedia: 10,
          participacaoEscola: 92,
          participacaoRede: 90,
        },
      ]),
    ],
    [],
    [
      buildIndicatorCard('Total de Habilidades', 1),
      buildIndicatorCard('Área / Disciplina', 'Matemática'),
    ],
  ];
}

async function createLegacyWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();

  const metadata = workbook.addWorksheet('metadata');
  metadata.addRow(['chave', 'valor']);
  metadata.addRow(['municipio', 'Canoas']);
  metadata.addRow(['ano', '2025']);
  metadata.addRow(['ciclo', '2025-sem1']);
  metadata.addRow(['data', '2025-06-01']);

  const escolas = workbook.addWorksheet('escolas');
  escolas.addRow(['id_escola', 'nome_escola']);
  escolas.addRow(['1', 'Escola Alpha']);

  const resultados = workbook.addWorksheet('resultados');
  resultados.addRow(['id_escola', 'ano', 'disciplina', 'media', 'participacao']);
  resultados.addRow(['1', '5', 'Matemática', 250, 90]);

  const distribuicao = workbook.addWorksheet('distribuicao');
  distribuicao.addRow(['id_escola', 'nivel', 'alunos']);
  distribuicao.addRow(['1', 'adequado', 10]);

  await workbook.xlsx.writeFile(filePath);
}

describe('buildHtmlDocument()', () => {
  test('renders print-friendly HTML with pages, indicators and components', () => {
    const designManifest = loadDefaultDesignManifest();
    const pages = makePdfPages().map((page) => ({
      ...page,
      layout: resolveEditorialLayout(page, designManifest),
    }));
    const html = buildHtmlDocument(
      pages,
      makeChartsPerPage(),
      { municipio: 'Canoas', ano: 2025, ciclo: '2025-sem1' },
      {
        designManifest,
        theme: {
          colors: {
            primary: '#0D47A1',
          },
        },
        version: 'v9',
      },
    );

    expect(html).toContain('Visão Geral da Rede');
    expect(html).toContain('Total de Escolas');
    expect(html).toContain('Habilidades — Matemática');
    expect(html).toContain('#0D47A1');
    expect(html).toContain('@page');
    expect(html).toContain('chart-panel');
    expect(html).toContain('Ranking geral da rede: 1º lugar');
    expect(html).toContain('Canoas • 2025-sem1 • 2025 • v9');
    expect(html).toContain('data-design-manifest-id="educacross-book-editorial"');
    expect(html).toContain('data-shell-ref="cover-slab"');
    expect(html).toContain('data-shell-ref="chapter-hero-shell"');
    expect(html).toContain('class="cover-band" data-layout="cover-slab" data-shell-ref="cover-slab"');
    expect(html).toContain('class="chapter-hero chapter-hero-resultados" data-layout="chapter-hero-shell" data-shell-ref="chapter-hero-shell"');
    expect(html).toContain('data-style-ref="analytic-overview"');
    expect(html).toContain('data-shell-ref="network-overview-shell"');
    expect(html).toContain('data-layout-source="manifest"');
    expect(html).toContain('data-shell-ref="editorial-table-shell"');
    expect(html).toContain('indicator-card indicator-card-participacao-media');
    expect(html).toContain('priority-context-card priority-context-card-referencia');
    expect(html).toContain('panel panel-overview-summary');
    expect(html).toContain('summary-callout summary-callout-overview');
    expect(html).toContain('class="overview-shell-main"');
    expect(html).toContain('class="overview-shell-aside"');
    expect(html).toContain('data-style-ref="dense-table"');
    expect(html).toContain('data-shell-ref="school-comparison-shell"');
    expect(html).toContain('data-layout="school-comparison-shell"');
    expect(html).toContain('dense-table-context-strip');
    expect(html).toContain('class="panel dense-table-panel dense-table-panel-skills"');
    expect(html).toContain('class="skills-table dense-table-table"');
  });

  test('resolves local image assets relative to the print html path when provided', () => {
    const designManifest = loadDefaultDesignManifest();
    const htmlOutputPath = path.join(
      process.cwd(),
      'packages',
      'book-de-resultados',
      'examples',
      '.runtime',
      'manual-layout-test',
      'preview.print.html',
    );
    const expectedLogoPath = encodeURI(
      path.relative(path.dirname(htmlOutputPath), designManifest.assets.logoUrl).split(path.sep).join('/'),
    );

    const html = buildHtmlDocument(
      [
        {
          section: 'capa',
          title: 'Capa',
          pageNumber: 1,
          data: {
            municipio: 'Canoas',
            ano: '2025',
            ciclo: '2025-sem1',
            logoUrl: designManifest.assets.logoUrl,
          },
          layout: resolveEditorialLayout({ section: 'capa', data: {} }, designManifest),
        },
      ],
      [[]],
      { municipio: 'Canoas', ano: 2025, ciclo: '2025-sem1' },
      { designManifest, htmlOutputPath },
    );

    expect(html).toContain(`src="${expectedLogoPath}"`);
    expect(html).not.toContain('src="file:///');
  });

  test('renders resultados_ano ranking rows and keeps full habilidades pagination context', () => {
    const habilidadeRows = Array.from({ length: 25 }, (_, index) => ({
      codigo: `MAT${index + 1}`,
      descricao: `Habilidade ${index + 1}`,
      percentualAcerto: 60 + index,
    }));
    const tabela = buildHabilidadesTable(
      habilidadeRows,
      { title: 'Habilidades — Matemática', columns: ['codigo', 'descricao', 'percentualAcerto'], maxRowsPerPage: 20 },
    );
    const rankingRows = [
      { nome_escola: 'Escola Alpha', media: 257.5, participacao: 91.5, posicao: 1 },
      { nome_escola: 'Escola Beta', media: 195, participacao: 75, posicao: 2 },
    ];

    const html = buildHtmlDocument(
      [
        {
          section: 'resultados_ano',
          title: 'Resultados por Ano/Série — 5',
          pageNumber: 1,
          data: {
            ano: '5',
            mediaRede: 226.3,
            participacaoMedia: 83.3,
            escolas: rankingRows,
          },
        },
        {
          section: 'habilidades_disciplina',
          title: 'Habilidades — Matemática (2/2)',
          pageNumber: 2,
          data: {
            disciplina: 'Matemática',
            pageIndex: 1,
            totalHabilidades: 25,
            rows: tabela.pages[1],
            components: {
              tabela,
            },
          },
        },
      ],
      [
        [
          buildIndicatorCard('Média da Rede', 226.3),
          buildIndicatorCard('Escolas com resultados', 2),
          buildIndicatorCard('Participação Média', '83.3%'),
          buildRankingChart(rankingRows, 'Ranking de Escolas — 5'),
        ],
        [
          buildIndicatorCard('Total de Habilidades', 25),
          buildIndicatorCard('Área / Disciplina', 'Matemática'),
        ],
      ],
      { municipio: 'Canoas', ano: 2025, ciclo: '2025-sem1' },
      { version: 'v9' },
    );

    expect(html).toContain('Escola Alpha');
    expect(html).toContain('Escola Beta');
    expect(html).toContain('2 / 2 páginas • 25 habilidades no total');
    expect(html).toContain('MAT21');
    expect(html).not.toContain('MAT1</td>');
  });
});

describe('resolvePdfBrowserPath()', () => {
  test('returns the explicit browser path when it exists', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-pdf-browser-'));
    const browserPath = path.join(tempDir, 'msedge.exe');
    fs.writeFileSync(browserPath, '');

    try {
      expect(resolvePdfBrowserPath(browserPath)).toBe(browserPath);
    } finally {
      fs.unlinkSync(browserPath);
      fs.rmdirSync(tempDir);
    }
  });
});

describe('exportPdf()', () => {
  beforeEach(() => {
    execFile.mockImplementation((browserPath, args, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      const pdfArg = args.find((arg) => String(arg).startsWith('--print-to-pdf='));
      const pdfPath = String(pdfArg).slice('--print-to-pdf='.length);
      fs.writeFileSync(pdfPath, '%PDF-1.4\n% mocked\n', 'utf-8');
      done(null, '', '');
    });
  });

  afterEach(() => {
    execFile.mockReset();
  });

  test('writes a PDF file and cleans up the temporary HTML by default', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-pdf-export-'));
    const browserPath = path.join(tempDir, 'msedge.exe');
    fs.writeFileSync(browserPath, '');

    try {
      const filePath = await exportPdf(
        makePdfPages(),
        makeChartsPerPage(),
        { municipio: 'Canoas', ano: 2025, ciclo: '2025-sem1' },
        tempDir,
        { browserPath, version: 'v2' },
      );

      expect(filePath).toMatch(/\.pdf$/);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toContain('%PDF-1.4');
      expect(fs.readdirSync(tempDir).some((entry) => entry.endsWith('.print.html'))).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('keeps the print HTML and emits a review manifest in reviewHtml mode', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-pdf-review-'));
    const browserPath = path.join(tempDir, 'msedge.exe');
    fs.writeFileSync(browserPath, '');

    try {
      const artifactCollector = {};
      const filePath = await exportPdf(
        makePdfPages(),
        makeChartsPerPage(),
        { municipio: 'Canoas', ano: 2025, ciclo: '2025-sem1' },
        tempDir,
        { browserPath, version: 'v2', reviewHtml: true, artifactCollector, designManifest: loadDefaultDesignManifest() },
      );

      expect(filePath).toMatch(/\.pdf$/);
      expect(artifactCollector.pdfFile).toBe(filePath);
      expect(artifactCollector.printHtmlFile).toMatch(/\.print\.html$/);
      expect(artifactCollector.reviewManifestFile).toMatch(/\.print\.review\.json$/);
      expect(fs.existsSync(artifactCollector.printHtmlFile)).toBe(true);
      expect(fs.existsSync(artifactCollector.reviewManifestFile)).toBe(true);
      expect(JSON.parse(fs.readFileSync(artifactCollector.reviewManifestFile, 'utf-8'))).toMatchObject({
        designManifest: { id: 'educacross-book-editorial' },
        sourceOfTruth: 'html-paginado',
        document: { pageCount: 6 },
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('generateBook() with PDF output', () => {
  beforeEach(() => {
    execFile.mockImplementation((browserPath, args, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      const pdfArg = args.find((arg) => String(arg).startsWith('--print-to-pdf='));
      const pdfPath = String(pdfArg).slice('--print-to-pdf='.length);
      fs.writeFileSync(pdfPath, '%PDF-1.4\n% generated\n', 'utf-8');
      done(null, '', '');
    });
  });

  afterEach(() => {
    execFile.mockReset();
  });

  test('supports format "pdf" through the public API', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-generate-pdf-'));
    const workbookPath = path.join(tempDir, 'legacy-book.xlsx');
    const browserPath = path.join(tempDir, 'msedge.exe');
    fs.writeFileSync(browserPath, '');
    await createLegacyWorkbook(workbookPath);

    try {
      const result = await generateBook({
        inputFile: workbookPath,
        outputDir: tempDir,
        format: 'pdf',
        version: 'v3',
        pdfBrowserPath: browserPath,
      });

      expect(result.success).toBe(true);
      expect(result.outputFile).toMatch(/\.pdf$/);
      expect(result.filename).toMatch(/\.pdf$/);
      expect(result.pageCount).toBeGreaterThan(0);
      expect(fs.readFileSync(result.outputFile, 'utf-8')).toContain('%PDF-1.4');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('returns review artifacts when reviewHtml=true', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-generate-pdf-review-'));
    const workbookPath = path.join(tempDir, 'legacy-book.xlsx');
    const browserPath = path.join(tempDir, 'msedge.exe');
    fs.writeFileSync(browserPath, '');
    await createLegacyWorkbook(workbookPath);

    try {
      const result = await generateBook({
        inputFile: workbookPath,
        outputDir: tempDir,
        format: 'pdf',
        version: 'v3',
        pdfBrowserPath: browserPath,
        reviewHtml: true,
      });

      expect(result.success).toBe(true);
      expect(result.artifacts).toMatchObject({
        pdfFile: result.outputFile,
        printHtmlFile: expect.stringMatching(/\.print\.html$/),
        reviewManifestFile: expect.stringMatching(/\.print\.review\.json$/),
        editorialBaselineFile: expect.stringMatching(/editorial-review-baseline\.json$/),
      });
      expect(fs.existsSync(result.artifacts.printHtmlFile)).toBe(true);
      expect(fs.existsSync(result.artifacts.reviewManifestFile)).toBe(true);
      const reviewManifest = JSON.parse(fs.readFileSync(result.artifacts.reviewManifestFile, 'utf-8'));
      expect(reviewManifest.baseline.referenceArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'pdf',
            path: expect.stringMatching(/canoas-2025-sem2/),
          }),
        ]),
      );
      expect(reviewManifest.priorityPages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            section: 'capa',
            layout: expect.objectContaining({ templateId: 'cover-page' }),
          }),
        ]),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
