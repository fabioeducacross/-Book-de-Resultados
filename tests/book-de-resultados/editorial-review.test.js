'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  EDITORIAL_BASELINE_PATH,
  loadEditorialReviewBaseline,
  buildEditorialReviewManifest,
  writeEditorialReviewManifest,
} = require('../../packages/book-de-resultados/src/editorial-review');
const { loadDefaultDesignManifest } = require('../../packages/book-de-resultados/src/design-manifest');

describe('editorial-review helpers', () => {
  test('loads the versioned editorial baseline for the current book', () => {
    const baseline = loadEditorialReviewBaseline();

    expect(EDITORIAL_BASELINE_PATH).toMatch(/editorial-review-baseline\.json$/);
    expect(baseline.id).toBe('book-atual-html-review');
    expect(baseline.sourceArtifact).toBe('book atual');
    expect(baseline.referenceArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'pdf',
          path: expect.stringMatching(/canoas-2025-sem2/),
        }),
      ]),
    );
    expect(baseline.prioritySections).toEqual(
      expect.arrayContaining(['capa', 'capitulo', 'visao_geral', 'resultados_disciplina']),
    );
    expect(baseline.reviewChecklist.global).toEqual(expect.any(Array));
  });

  test('builds a review manifest with priority pages and artifact paths', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-review-manifest-'));
    const htmlPath = path.join(tempDir, 'relatorio_canoas_2025_v1.print.html');
    const pdfPath = path.join(tempDir, 'relatorio_canoas_2025_v1.pdf');

    try {
      const manifest = buildEditorialReviewManifest({
        designManifest: loadDefaultDesignManifest(),
        pages: [
          {
            section: 'capa',
            title: 'Capa',
            pageNumber: 1,
            data: {},
            layout: { templateId: 'cover-page', variant: 'institutional-cover', reviewPriority: 'primary' },
          },
          {
            section: 'resultados_disciplina',
            title: 'Resultados — Matemática',
            pageNumber: 2,
            data: { disciplina: 'Matemática', layoutHeading: 'Resultados em Matemática' },
            layout: { templateId: 'discipline-results', variant: 'discipline-matematica', reviewPriority: 'primary' },
          },
          { section: 'escola', title: 'EMEF Escola Alfa', pageNumber: 3, data: { nome_escola: 'EMEF Escola Alfa' } },
        ],
        metadata: { municipio: 'Canoas', ano: '2025', ciclo: '2025-sem2' },
        version: 'v1',
        htmlPath,
        pdfPath,
        outputFile: pdfPath,
      });

      expect(manifest.document.pageCount).toBe(3);
      expect(manifest.artifacts.htmlPath).toBe(htmlPath);
      expect(manifest.artifacts.pdfPath).toBe(pdfPath);
      expect(manifest.artifacts.reviewManifestPath).toMatch(/\.print\.review\.json$/);
      expect(manifest.designManifest).toMatchObject({
        id: 'educacross-book-editorial',
        manifestVersion: '1.0.0',
        themeTokensFile: 'theme.tokens.yaml',
      });
      expect(manifest.priorityPages).toHaveLength(2);
      expect(manifest.priorityPages.map((page) => page.section)).toEqual(['capa', 'resultados_disciplina']);
      expect(manifest.priorityPages[0].layout).toMatchObject({
        templateId: 'cover-page',
        variant: 'institutional-cover',
        reviewPriority: 'primary',
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('writes the review manifest next to the print HTML', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-review-write-'));
    const htmlPath = path.join(tempDir, 'relatorio_canoas_2025_v1.print.html');

    try {
      fs.writeFileSync(htmlPath, '<html></html>', 'utf-8');

      const result = writeEditorialReviewManifest({
        designManifest: loadDefaultDesignManifest(),
        pages: [{ section: 'capa', title: 'Capa', pageNumber: 1, data: {} }],
        metadata: { municipio: 'Canoas', ano: '2025', ciclo: '2025-sem2' },
        version: 'v1',
        htmlPath,
        pdfPath: path.join(tempDir, 'relatorio_canoas_2025_v1.pdf'),
        outputFile: path.join(tempDir, 'relatorio_canoas_2025_v1.pdf'),
      });

      expect(fs.existsSync(result.reviewPath)).toBe(true);
      expect(result.baselinePath).toBe(EDITORIAL_BASELINE_PATH);
      expect(JSON.parse(fs.readFileSync(result.reviewPath, 'utf-8'))).toMatchObject({
        designManifest: { id: 'educacross-book-editorial' },
        document: { municipio: 'Canoas', pageCount: 1 },
        artifacts: { htmlPath },
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('includes styleRef and layoutSource in page summaries when present', () => {
    const manifest = buildEditorialReviewManifest({
      designManifest: loadDefaultDesignManifest(),
      pages: [
        {
          section: 'ranking',
          title: 'Ranking — Matemática',
          pageNumber: 1,
          data: { disciplina: 'Matemática' },
          layout: {
            templateId: 'ranking-table',
            variant: 'ranking',
            styleRef: 'dense-table',
            layoutSource: 'manifest',
          },
        },
      ],
      metadata: { municipio: 'Canoas', ano: '2025', ciclo: '2025-sem2' },
      version: 'v1',
      htmlPath: 'C:/tmp/book.print.html',
      pdfPath: 'C:/tmp/book.pdf',
      outputFile: 'C:/tmp/book.pdf',
    });

    expect(manifest.pages[0].layout).toMatchObject({
      styleRef: 'dense-table',
      layoutSource: 'manifest',
    });
  });
});
