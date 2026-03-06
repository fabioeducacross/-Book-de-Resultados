'use strict';

/**
 * Exporter — Book de Resultados
 *
 * Exports the rendered book pages to PDF or PPTX format.
 *
 * PDF export: Uses pptxgenjs PPTX as an intermediary or direct HTML/JSON export.
 * PPTX export: Uses pptxgenjs to build a presentation with one slide per page.
 *
 * The output file name follows the convention:
 *   relatorio_{municipio}_{ano}_{ciclo}_{version}.{ext}
 *
 * Example: relatorio_canoas_2025_sem2_v1.pdf
 */

const fs = require('fs');
const path = require('path');

/**
 * Builds the output file name following the versioning convention.
 * @param {object} metadata - { municipio, ano, ciclo }
 * @param {string} format - 'pdf' | 'pptx'
 * @param {string} [version] - version string, e.g. 'v1'
 * @returns {string}
 */
function buildOutputFilename(metadata, format, version = 'v1') {
  const municipio = sanitizeFilenameSegment(String(metadata.municipio || 'municipio'));
  const ano = sanitizeFilenameSegment(String(metadata.ano || 'ano'));
  const ciclo = sanitizeFilenameSegment(String(metadata.ciclo || 'ciclo'));
  return `relatorio_${municipio}_${ano}_${ciclo}_${version}.${format}`;
}

/**
 * Exports the book as a PPTX file using pptxgenjs.
 * Each page of the rendered book becomes one slide.
 * @param {object[]} pages - Rendered pages (from renderer.render)
 * @param {object[]} chartsPerPage - Chart descriptors for each page
 * @param {object} metadata - { municipio, ano, ciclo }
 * @param {string} outputDir - Directory to write the file to
 * @param {object} [options]
 * @param {string} [options.version] - version string
 * @returns {Promise<string>} Path to the generated PPTX file
 */
async function exportPptx(pages, chartsPerPage, metadata, outputDir, options = {}) {
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `Relatório de Resultados — ${metadata.municipio || ''} ${metadata.ano || ''}`;
  pptx.subject = `Ciclo: ${metadata.ciclo || ''}`;
  pptx.author = 'Book de Resultados Automático';

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const charts = chartsPerPage[i] || [];
    addSlide(pptx, page, charts);
  }

  const filename = buildOutputFilename(metadata, 'pptx', options.version || 'v1');
  const filePath = path.join(outputDir, filename);

  await pptx.writeFile({ fileName: filePath });

  return filePath;
}

/**
 * Exports the book as a JSON file (useful for debugging or downstream rendering).
 * @param {object[]} pages
 * @param {object[]} chartsPerPage
 * @param {object} metadata
 * @param {string} outputDir
 * @param {object} [options]
 * @returns {Promise<string>} Path to the generated JSON file
 */
async function exportJson(pages, chartsPerPage, metadata, outputDir, options = {}) {
  const filename = buildOutputFilename(metadata, 'json', options.version || 'v1');
  const filePath = path.join(outputDir, filename);

  const output = {
    metadata,
    generatedAt: new Date().toISOString(),
    version: options.version || 'v1',
    pages: pages.map((page, i) => ({ ...page, charts: chartsPerPage[i] || [] })),
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');

  return filePath;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Adds a single slide to the PPTX for a given page.
 * @param {object} pptx - PptxGenJS instance
 * @param {object} page - Rendered page
 * @param {object[]} charts - Chart descriptors for the page
 */
function addSlide(pptx, page, charts) {
  const slide = pptx.addSlide();

  // Slide title
  slide.addText(page.title || '', {
    x: 0.3,
    y: 0.1,
    w: '90%',
    h: 0.6,
    fontSize: 20,
    bold: true,
    color: '1A237E',
    fontFace: 'Calibri',
  });

  // Page number
  slide.addText(`Página ${page.pageNumber}`, {
    x: 8.5,
    y: 0.1,
    w: 1.2,
    h: 0.3,
    fontSize: 10,
    color: '757575',
    align: 'right',
  });

  // Render content based on section type
  renderSlideContent(slide, page, charts);
}

/**
 * Renders slide content based on page section type.
 * @param {object} slide - PptxGenJS slide
 * @param {object} page
 * @param {object[]} charts
 */
function renderSlideContent(slide, page, charts) {
  const { section, data } = page;

  switch (section) {
    case 'capa':
      slide.addText(`Relatório de Resultados da Avaliação`, {
        x: 1,
        y: 1.2,
        w: 8,
        h: 0.8,
        fontSize: 28,
        bold: true,
        color: '1A237E',
        align: 'center',
      });
      slide.addText(data.municipio, { x: 1, y: 2.2, w: 8, h: 0.5, fontSize: 18, align: 'center', color: '424242' });
      slide.addText(`${data.ano} | ${data.ciclo}`, {
        x: 1,
        y: 2.8,
        w: 8,
        h: 0.4,
        fontSize: 14,
        align: 'center',
        color: '757575',
      });
      break;

    case 'visao_geral':
    case 'resultados_disciplina':
    case 'escola':
    case 'resultados_ano':
      addIndicatorCards(slide, charts);
      addDistributionTable(slide, data.distribuicao, 1.5);
      break;

    case 'ranking':
      addRankingTable(slide, data.rows);
      break;

    case 'sumario':
      addSumarioEntries(slide, data.entries);
      break;

    case 'apresentacao':
      addTextBlock(
        slide,
        `O presente relatório apresenta os resultados da avaliação educacional realizada no município de ${data.municipio}, ciclo ${data.ciclo}. Participaram desta avaliação ${data.totalEscolas} escolas e ${data.totalAlunos} estudantes.`,
        1,
      );
      break;

    case 'metodologia':
      addTextBlock(
        slide,
        `A avaliação foi realizada no município de ${data.municipio} (${data.ano}, ciclo ${data.ciclo}), abrangendo ${data.totalAlunos} estudantes nas disciplinas: ${(data.disciplinas || []).join(', ')}.`,
        1,
      );
      break;

    default:
      break;
  }
}

function addIndicatorCards(slide, charts) {
  const indicators = charts.filter((c) => c.type === 'indicator');
  indicators.forEach((card, idx) => {
    const x = 0.3 + idx * 2.4;
    if (x > 8.5) return; // overflow guard
    slide.addShape(slide.ShapeType ? slide.ShapeType.rect : 'rect', {
      x,
      y: 0.9,
      w: 2.2,
      h: 1.0,
      fill: { color: 'E8EAF6' },
      line: { color: '3949AB', width: 1 },
    });
    slide.addText(String(card.valor), {
      x,
      y: 1.0,
      w: 2.2,
      h: 0.5,
      fontSize: 22,
      bold: true,
      color: '1A237E',
      align: 'center',
    });
    slide.addText(card.titulo, {
      x,
      y: 1.55,
      w: 2.2,
      h: 0.3,
      fontSize: 9,
      color: '424242',
      align: 'center',
    });
  });
}

function addDistributionTable(slide, distribuicao, yOffset) {
  if (!distribuicao) return;

  const niveis = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
  const NIVEL_LABELS = {
    abaixo_do_basico: 'Abaixo do Básico',
    basico: 'Básico',
    adequado: 'Adequado',
    avancado: 'Avançado',
  };

  const rows = [
    [
      { text: 'Nível', options: { bold: true } },
      { text: 'Alunos', options: { bold: true } },
      { text: '%', options: { bold: true } },
    ],
    ...niveis.map((nivel) => [
      NIVEL_LABELS[nivel],
      String(distribuicao[nivel] || 0),
      `${(distribuicao.percentuais || {})[nivel] || 0}%`,
    ]),
  ];

  slide.addTable(rows, {
    x: 0.3,
    y: yOffset,
    w: 4,
    fontSize: 10,
    border: { type: 'solid', color: 'BDBDBD', pt: 1 },
    fill: { color: 'FAFAFA' },
  });
}

function addRankingTable(slide, rows) {
  if (!rows || rows.length === 0) return;

  const tableRows = [
    [
      { text: 'Pos.', options: { bold: true } },
      { text: 'Escola', options: { bold: true } },
      { text: 'Participação', options: { bold: true } },
      { text: 'Média', options: { bold: true } },
    ],
    ...rows.map((row) => [
      String(row.posicao),
      row.nome_escola || '',
      `${row.participacao || 0}%`,
      String(row.media || 0),
    ]),
  ];

  slide.addTable(tableRows, {
    x: 0.3,
    y: 0.85,
    w: 9,
    fontSize: 10,
    border: { type: 'solid', color: 'BDBDBD', pt: 1 },
    fill: { color: 'FAFAFA' },
  });
}

function addSumarioEntries(slide, entries) {
  if (!entries || entries.length === 0) return;

  const tableRows = entries.map((entry) => [entry.title, String(entry.page)]);

  slide.addTable(tableRows, {
    x: 0.5,
    y: 0.85,
    w: 9,
    fontSize: 11,
    border: { type: 'solid', color: 'BDBDBD', pt: 1 },
  });
}

function addTextBlock(slide, text, yOffset) {
  slide.addText(text, {
    x: 0.5,
    y: yOffset,
    w: 9,
    h: 3,
    fontSize: 12,
    color: '212121',
    wrap: true,
  });
}

/**
 * Sanitizes a string for use in a filename segment.
 * Lowercases, removes accents, replaces spaces/special chars with underscores.
 * @param {string} str
 * @returns {string}
 */
function sanitizeFilenameSegment(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

module.exports = { exportPptx, exportJson, buildOutputFilename, sanitizeFilenameSegment };
