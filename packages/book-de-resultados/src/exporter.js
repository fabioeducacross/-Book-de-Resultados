'use strict';

/**
 * Exporter — Book de Resultados
 *
 * Exports the rendered book pages to PDF or PPTX format.
 *
 * PDF export: Uses a print-friendly HTML document.
 * PPTX export: Uses pptxgenjs to build a presentation with one slide per page.
 * JSON export: Persists the render structure for debugging / downstream usage.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { DEFAULT_THEME, createTheme, pptxHex } = require('./theme');
const { buildHtmlDocument } = require('./html-renderer');
const { buildPageChrome } = require('./chrome');
const { writeEditorialReviewManifest } = require('./editorial-review');

function buildOutputFilename(metadata, format, version = 'v1') {
  const municipio = sanitizeFilenameSegment(String(metadata.municipio || 'municipio'));
  const ano = sanitizeFilenameSegment(String(metadata.ano || 'ano'));
  const ciclo = sanitizeFilenameSegment(String(metadata.ciclo || 'ciclo'));
  return `relatorio_${municipio}_${ano}_${ciclo}_${version}.${format}`;
}

async function exportPptx(pages, chartsPerPage, metadata, outputDir, options = {}) {
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  const theme = createTheme(options.theme || {});

  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `Relatório de Resultados — ${metadata.municipio || ''} ${metadata.ano || ''}`;
  pptx.subject = `Ciclo: ${metadata.ciclo || ''}`;
  pptx.author = 'Book de Resultados Automático';
  pptx.company = metadata.municipio || 'Book de Resultados';

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const charts = chartsPerPage[i] || [];
    addSlide(pptx, page, charts, theme, metadata, {
      version: options.version || 'v1',
      totalPages: pages.length,
    });
  }

  const filename = buildOutputFilename(metadata, 'pptx', options.version || 'v1');
  const filePath = path.join(outputDir, filename);

  await pptx.writeFile({ fileName: filePath });

  return filePath;
}

async function exportPdf(pages, chartsPerPage, metadata, outputDir, options = {}) {
  const theme = createTheme(options.theme || {});
  const filename = buildOutputFilename(metadata, 'pdf', options.version || 'v1');
  const filePath = path.join(outputDir, filename);
  const htmlPath = path.join(outputDir, `${path.parse(filename).name}.print.html`);
  const keepHtml = Boolean(options.keepHtml || options.reviewHtml);
  const html = buildHtmlDocument(pages, chartsPerPage, metadata, {
    theme,
    version: options.version || 'v1',
    designManifest: options.designManifest,
    htmlOutputPath: htmlPath,
  });

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(htmlPath, html, 'utf-8');

  try {
    const browserPath = resolvePdfBrowserPath(options.browserPath);
    await printHtmlToPdf(browserPath, htmlPath, filePath);
    await waitForFile(filePath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      throw new Error('Falha ao gerar o PDF: nenhum arquivo válido foi produzido pelo navegador');
    }

    let reviewArtifacts = null;
    if (options.reviewHtml) {
      reviewArtifacts = writeEditorialReviewManifest({
        pages,
        metadata,
        version: options.version || 'v1',
        htmlPath,
        pdfPath: filePath,
        outputFile: filePath,
        designManifest: options.designManifest,
      });
    }

    if (options.artifactCollector && typeof options.artifactCollector === 'object') {
      options.artifactCollector.pdfFile = filePath;
      if (keepHtml) {
        options.artifactCollector.printHtmlFile = htmlPath;
      }
      if (reviewArtifacts) {
        options.artifactCollector.reviewManifestFile = reviewArtifacts.reviewPath;
        options.artifactCollector.editorialBaselineFile = reviewArtifacts.baselinePath;
      }
    }

    return filePath;
  } finally {
    if (!keepHtml && fs.existsSync(htmlPath)) {
      fs.unlinkSync(htmlPath);
    }
  }
}

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

function addSlide(pptx, page, charts, theme, metadata, options = {}) {
  const resolvedTheme = theme || DEFAULT_THEME;
  const slide = pptx.addSlide();
  const t = resolvedTheme.typography || DEFAULT_THEME.typography;
  const c = resolvedTheme.colors || DEFAULT_THEME.colors;
  const chrome = buildPageChrome(page, metadata, options);
  const bodyFont = getBodyFont(t);
  const displayFont = getDisplayFont(t);

  if (chrome.variant !== 'opener') {
    slide.addText(chrome.sectionLabel, {
      x: 0.3,
      y: 0.08,
      w: 6.8,
      h: 0.18,
      fontSize: t.sizes ? t.sizes.tiny : 9,
      bold: true,
      color: pptxHex(c.accent || c.textMuted),
      fontFace: bodyFont,
      charSpace: 1.2,
    });

    slide.addText(page.title || '', {
      x: 0.3,
      y: 0.25,
      w: 8.4,
      h: 0.5,
      fontSize: t.sizes ? t.sizes.pageTitle : 22,
      bold: true,
      color: pptxHex(c.primary),
      fontFace: displayFont,
    });

    if (chrome.rankingBadge) {
      slide.addShape('roundRect', {
        x: 0.3,
        y: 0.7,
        w: 2.2,
        h: 0.28,
        rectRadius: 0.08,
        fill: { color: pptxHex(c.background) },
        line: { color: pptxHex(c.cardBorder), pt: 1 },
      });
      slide.addText(chrome.rankingBadge, {
        x: 0.36,
        y: 0.74,
        w: 2.08,
        h: 0.18,
        fontSize: t.sizes ? t.sizes.tiny : 9,
        bold: true,
        color: pptxHex(c.accent || c.primary),
        fontFace: bodyFont,
        align: 'center',
        margin: 0,
      });
    }

    slide.addText(chrome.pageLabel, {
      x: 10.4,
      y: 0.2,
      w: 2.3,
      h: 0.25,
      fontSize: t.sizes ? t.sizes.small : 10,
      color: pptxHex(c.textMuted),
      align: 'right',
      fontFace: bodyFont,
    });
  }

  renderSlideContent(slide, pptx, page, charts, resolvedTheme);
  if (chrome.variant !== 'opener') {
    addFooter(slide, chrome, resolvedTheme);
  }
}

function renderSlideContent(slide, pptx, page, charts, theme) {
  const { section, data } = page;
  const th = theme || DEFAULT_THEME;

  switch (section) {
    case 'capa':
      addCapaContent(slide, data, th);
      break;

    case 'capitulo':
      addCapituloContent(slide, data, th);
      break;

    case 'visao_geral': {
      addIndicatorCards(slide, charts, th);
      const distributionChart = findChart(charts, 'distribution');
      if (distributionChart) {
        addDistributionChart(slide, pptx, distributionChart, { x: 0.3, y: 1.85, w: 5.9, h: 2.3 }, th);
      }
      if (data.components && data.components.proficiencia) {
        addProficienciaComponent(slide, data.components.proficiencia, 1.85, th, { x: 6.45, w: 6.4 });
      } else {
        addDistributionTable(slide, data.distribuicao, 1.85, th, { x: 6.45, w: 6.2 });
      }
      addRedeResumoTable(slide, data.mediasPorDisciplina, th, { x: 0.3, y: 4.55, w: 12.35 });
      break;
    }

    case 'resultados_disciplina': {
      addIndicatorCards(slide, charts, th);
      const distributionChart = findChart(charts, 'distribution');
      if (distributionChart) {
        addDistributionChart(slide, pptx, distributionChart, { x: 0.3, y: 1.85, w: 5.9, h: 2.3 }, th);
      }
      if (data.components && data.components.proficiencia) {
        addProficienciaComponent(slide, data.components.proficiencia, 1.85, th, { x: 6.45, w: 6.4 });
      } else {
        addDistributionTable(slide, data.distribuicao, 1.85, th, { x: 6.45, w: 6.2 });
      }
      break;
    }

    case 'resultados_ano': {
      addIndicatorCards(slide, charts, th);
      const distributionChart = findChart(charts, 'distribution');
      const rankingChart = findChart(charts, 'ranking');

      if (distributionChart && rankingChart) {
        addDistributionChart(slide, pptx, distributionChart, { x: 0.3, y: 1.75, w: 5.9, h: 2.15 }, th);
        addRankingChart(slide, pptx, rankingChart, { x: 6.45, y: 1.75, w: 6.25, h: 2.15 }, th);
        addRankingTable(slide, data.escolas, th, { x: 0.3, y: 4.15, w: 12.4 });
      } else if (rankingChart) {
        addRankingChart(slide, pptx, rankingChart, { x: 0.3, y: 1.75, w: 5.9, h: 2.3 }, th);
        addRankingTable(slide, data.escolas, th, { x: 6.45, y: 1.75, w: 6.25 });
      } else if (distributionChart) {
        addDistributionChart(slide, pptx, distributionChart, { x: 0.3, y: 1.75, w: 5.9, h: 2.3 }, th);
        addRankingTable(slide, data.escolas, th, { x: 6.45, y: 1.75, w: 6.25 });
      } else if (data.escolas && data.escolas.length > 0) {
        addRankingTable(slide, data.escolas, th, { x: 0.3, y: 1.75, w: 12.4 });
      } else {
        addTextBlock(slide, 'Nenhuma escola com resultados disponíveis para este ano/série.', 1.75, th, { x: 0.3, w: 12.4, h: 1.2 });
      }
      break;
    }

    case 'escola': {
      addIndicatorCards(slide, charts, th);
      const distributionChart = findChart(charts, 'distribution');
      if (distributionChart) {
        addDistributionChart(slide, pptx, distributionChart, { x: 0.3, y: 1.85, w: 5.9, h: 2.3 }, th);
      }
      if (data.components && data.components.proficiencia) {
        addProficienciaComponent(slide, data.components.proficiencia, 1.85, th, { x: 6.45, w: 6.4 });
      } else {
        addDistributionTable(slide, data.distribuicao, 1.85, th, { x: 6.45, w: 6.2 });
      }
      addTextBlock(slide, data.sintese || '', 4.55, th, { x: 0.3, w: 12.4, h: 1.8 });
      break;
    }

    case 'escola_disciplinas': {
      addIndicatorCards(slide, charts, th);
      const comparativoChart = findChart(charts, 'comparativo_chart');
      if (comparativoChart) {
        addComparativoChart(slide, pptx, comparativoChart, { x: 0.3, y: 1.65, w: 5.9, h: 2.2 }, th);
      }
      if (data.components && data.components.comparativo) {
        addComparativoComponent(slide, data.components.comparativo, 1.65, th, { x: 6.45, w: 6.25 });
      } else {
        addSchoolComparativeTable(slide, data.participacaoPorDisciplina, 1.65, 6.45, 6.25, th);
      }
      addTextBlock(slide, data.sintese || '', 4.45, th, { x: 0.3, w: 12.4, h: 1.6 });
      break;
    }

    case 'habilidades_disciplina':
      addHabilidadesSlide(slide, data, th);
      break;

    case 'ranking': {
      const rankingChart = findChart(charts, 'ranking');
      if (rankingChart) {
        addRankingChart(slide, pptx, rankingChart, { x: 0.3, y: 1.0, w: 12.1, h: 2.5 }, th);
      }
      addRankingTable(slide, data.rows, th, { x: 0.3, y: 3.95, w: 12.1 });
      break;
    }

    case 'sumario':
      addSumarioEntries(slide, data.entries, th);
      break;

    case 'apresentacao':
      addTextBlock(
        slide,
        `O presente relatório apresenta os resultados da avaliação educacional realizada no município de ${data.municipio}, ciclo ${data.ciclo}. Participaram desta avaliação ${data.totalEscolas} escolas e ${data.totalAlunos} estudantes.`,
        1,
        th,
        { x: 0.5, w: 12, h: 3.5 },
      );
      break;

    case 'contexto_avaliacao':
    case 'participacao_rede':
      addTextBlock(slide, data.body || '', 1, th, { x: 0.5, w: 12, h: 4.5 });
      break;

    case 'metodologia':
      addTextBlock(
        slide,
        `A avaliação foi realizada no município de ${data.municipio} (${data.ano}, ciclo ${data.ciclo}), abrangendo ${data.totalAlunos} estudantes nas disciplinas: ${(data.disciplinas || []).join(', ')}.`,
        1,
        th,
        { x: 0.5, w: 12, h: 4.5 },
      );
      break;

    case 'proximos_passos':
      addTextBlock(slide, data.body || '', 1, th, { x: 0.5, w: 12, h: 1.6 });
      addBulletList(slide, data.recommendations || [], 2.25, th, { x: 0.8, w: 11.4, h: 2.8 });
      break;

    default:
      break;
  }
}

function addFooter(slide, chrome, theme) {
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const face = getBodyFont(t);

  slide.addShape('line', {
    x: 0.3,
    y: 6.95,
    w: 12.4,
    h: 0,
    line: { color: pptxHex(c.tableBorder), pt: 1 },
  });

  slide.addText(chrome.editionLabel || '', {
    x: 0.3,
    y: 7.02,
    w: 5.2,
    h: 0.2,
    fontSize: t.sizes ? t.sizes.tiny : 9,
    color: pptxHex(c.textMuted),
    fontFace: face,
  });

  slide.addText(chrome.footerCenter || '', {
    x: 4.7,
    y: 7.02,
    w: 3.9,
    h: 0.2,
    fontSize: t.sizes ? t.sizes.tiny : 9,
    color: pptxHex(c.textMuted),
    fontFace: face,
    align: 'center',
  });

  slide.addText(chrome.pageLabel || '', {
    x: 10.2,
    y: 7.02,
    w: 2.5,
    h: 0.2,
    fontSize: t.sizes ? t.sizes.tiny : 9,
    color: pptxHex(c.textMuted),
    fontFace: face,
    align: 'right',
  });
}

function addDistributionChart(slide, pptx, chart, layout, theme) {
  if (!chart || !(chart.series || []).length) return;
  const colors = (theme || DEFAULT_THEME).colors || DEFAULT_THEME.colors;
  const typography = (theme || DEFAULT_THEME).typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(typography);
  const displayFont = getDisplayFont(typography);
  const panelX = layout.x;
  const panelY = layout.y;
  const panelW = layout.w;
  const panelH = layout.h;
  const innerX = panelX + 0.18;
  const innerW = panelW - 0.36;
  const bandY = panelY + 0.52;
  const bandH = 0.38;
  const totalPercent = Math.max(
    1,
    chart.series.reduce((sum, item) => sum + Math.max(0, Number(item.percentual) || 0), 0),
  );

  slide.addShape('roundRect', {
    x: panelX,
    y: panelY,
    w: panelW,
    h: panelH,
    rectRadius: 0.04,
    fill: { color: pptxHex(colors.surface) },
    line: { color: pptxHex(colors.tableBorder), pt: 1 },
  });

  slide.addText(chart.title || 'Distribuição', {
    x: innerX,
    y: panelY + 0.14,
    w: innerW,
    h: 0.18,
    fontSize: typography.sizes ? typography.sizes.subheading : 13,
    bold: true,
    color: pptxHex(colors.primary),
    fontFace: displayFont,
    margin: 0,
  });

  slide.addShape('roundRect', {
    x: innerX,
    y: bandY,
    w: innerW,
    h: bandH,
    rectRadius: 0.04,
    fill: { color: pptxHex(colors.tableHeader) },
    line: { color: pptxHex(colors.tableBorder), pt: 1 },
  });

  let cursorX = innerX;
  chart.series.forEach((item) => {
    const pct = Math.max(0, Number(item.percentual) || 0);
    const segmentW = Math.max(0.18, (innerW * pct) / totalPercent);
    slide.addShape('rect', {
      x: cursorX,
      y: bandY,
      w: Math.min(segmentW, innerX + innerW - cursorX),
      h: bandH,
      fill: { color: pptxHex(item.color) },
      line: { color: pptxHex(item.color), pt: 0.5 },
    });
    if (segmentW >= 0.45) {
      slide.addText(`${pct}%`, {
        x: cursorX,
        y: bandY + 0.06,
        w: Math.min(segmentW, innerX + innerW - cursorX),
        h: 0.12,
        fontSize: typography.sizes ? typography.sizes.tiny : 9,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
        margin: 0,
        fontFace: bodyFont,
      });
    }
    cursorX += segmentW;
  });

  chart.series.forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const itemX = innerX + column * (innerW / 2);
    const itemY = panelY + 1.1 + row * 0.42;
    slide.addShape('rect', {
      x: itemX,
      y: itemY + 0.03,
      w: 0.14,
      h: 0.14,
      fill: { color: pptxHex(item.color) },
      line: { color: pptxHex(item.color), pt: 0.5 },
    });
    slide.addText(`${item.label}: ${item.alunos} alunos (${item.percentual}%)`, {
      x: itemX + 0.2,
      y: itemY,
      w: innerW / 2 - 0.24,
      h: 0.18,
      fontSize: typography.sizes ? typography.sizes.tiny : 9,
      color: pptxHex(colors.textSecondary),
      fontFace: bodyFont,
      margin: 0,
    });
  });
}

function addRankingChart(slide, pptx, chart, layout, theme) {
  if (!chart || !(chart.bars || []).length) return;
  const colors = (theme || DEFAULT_THEME).colors || DEFAULT_THEME.colors;
  const typography = (theme || DEFAULT_THEME).typography || DEFAULT_THEME.typography;

  slide.addChart(
    pptx.ChartType.bar,
    [
      {
        name: 'Média',
        labels: chart.bars.map((bar) => `${bar.posicao}º ${bar.label}`),
        values: chart.bars.map((bar) => Number(bar.value) || 0),
      },
    ],
    {
      x: layout.x,
      y: layout.y,
      w: layout.w,
      h: layout.h,
      chartColors: [pptxHex((chart.bars[0] || {}).color || colors.primary)],
      showLegend: false,
      showTitle: false,
      showValue: true,
      valAxisMinVal: 0,
      valAxisMaxVal: Math.max(chart.maxValue || 0, 1),
      catAxisLabelFontSize: typography.sizes ? typography.sizes.tiny : 9,
      valAxisLabelFontSize: typography.sizes ? typography.sizes.tiny : 9,
      border: { color: pptxHex(colors.tableBorder), pt: 1 },
      fill: { color: pptxHex(colors.surface) },
      valGridLine: { color: pptxHex(colors.tableBorder), style: 'dash', size: 1 },
    },
  );
}

function addComparativoChart(slide, pptx, chart, layout, theme) {
  if (!chart || !(chart.pairs || []).length) return;
  const colors = (theme || DEFAULT_THEME).colors || DEFAULT_THEME.colors;
  const typography = (theme || DEFAULT_THEME).typography || DEFAULT_THEME.typography;

  slide.addChart(
    pptx.ChartType.bar,
    [
      {
        name: 'Escola',
        labels: chart.pairs.map((pair) => pair.label),
        values: chart.pairs.map((pair) => Number(pair.escola.value) || 0),
      },
      {
        name: 'Rede',
        labels: chart.pairs.map((pair) => pair.label),
        values: chart.pairs.map((pair) => Number(pair.rede.value) || 0),
      },
    ],
    {
      x: layout.x,
      y: layout.y,
      w: layout.w,
      h: layout.h,
      chartColors: [
        pptxHex(((chart.pairs[0] || {}).escola || {}).color || colors.primary),
        pptxHex(((chart.pairs[0] || {}).rede || {}).color || colors.secondary),
      ],
      showLegend: true,
      showTitle: false,
      showValue: true,
      legendPos: 'b',
      valAxisMinVal: Math.min(0, chart.minValue || 0),
      valAxisMaxVal: Math.max(chart.maxValue || 0, 1),
      catAxisLabelFontSize: typography.sizes ? typography.sizes.tiny : 9,
      valAxisLabelFontSize: typography.sizes ? typography.sizes.tiny : 9,
      border: { color: pptxHex(colors.tableBorder), pt: 1 },
      fill: { color: pptxHex(colors.surface) },
      valGridLine: { color: pptxHex(colors.tableBorder), style: 'dash', size: 1 },
    },
  );
}

function addProficienciaComponent(slide, component, yOffset, theme, layout = {}) {
  if (!component || !component.bars) return;
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);
  const headerFill = pptxHex(c.tableHeader || DEFAULT_THEME.colors.tableHeader);
  const borderColor = pptxHex(c.tableBorder || DEFAULT_THEME.colors.tableBorder);

  const headerRow = [
    { text: 'Nível de Proficiência', options: { bold: true, fill: headerFill } },
    { text: 'Alunos', options: { bold: true, fill: headerFill } },
    { text: '%', options: { bold: true, fill: headerFill } },
  ];

  const dataRows = component.bars.map((bar) => {
    const levelFill = pptxHex(bar.color);
    return [
      { text: bar.label, options: { bold: true, fill: levelFill, color: 'FFFFFF' } },
      { text: String(bar.alunos), options: {} },
      { text: `${bar.percentual}%`, options: {} },
    ];
  });

  const totalRow = [
    { text: 'Total', options: { bold: true, fill: headerFill } },
    { text: String(component.total || 0), options: { bold: true } },
    { text: '100%', options: { bold: true } },
  ];

  slide.addTable([headerRow, ...dataRows, totalRow], {
    x: layout.x != null ? layout.x : 0.3,
    y: yOffset,
    w: layout.w != null ? layout.w : 4.5,
    fontSize: t.sizes ? t.sizes.small : 10,
    border: { type: 'solid', color: borderColor, pt: 1 },
    fill: { color: pptxHex(c.tableSurface || DEFAULT_THEME.colors.tableSurface) },
    fontFace: bodyFont,
  });
}

function addComparativoComponent(slide, component, yOffset, theme, layout = {}) {
  if (!component || !component.rows || component.rows.length === 0) return;
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);
  const headerFill = pptxHex(c.tableHeader || DEFAULT_THEME.colors.tableHeader);
  const borderColor = pptxHex(c.tableBorder || DEFAULT_THEME.colors.tableBorder);

  const headerRow = [
    { text: 'Área / Disciplina', options: { bold: true, fill: headerFill } },
    { text: 'Escola — Média', options: { bold: true, fill: headerFill } },
    { text: 'Rede — Média', options: { bold: true, fill: headerFill } },
    { text: 'Δ Média', options: { bold: true, fill: headerFill } },
    { text: 'Part. Escola', options: { bold: true, fill: headerFill } },
    { text: 'Part. Rede', options: { bold: true, fill: headerFill } },
  ];

  const dataRows = component.rows.map((row) => {
    const deltaMediaColor = pptxHex(row.delta.mediaColor);
    const isNonZero = row.delta.media != null && Number.isFinite(Number(row.delta.media)) && Number(row.delta.media) !== 0;
    return [
      { text: row.disciplina || '', options: {} },
      { text: row.escola.media != null ? String(row.escola.media) : '—', options: {} },
      { text: row.rede.media != null ? String(row.rede.media) : '—', options: {} },
      { text: row.delta.mediaFormatted, options: { color: deltaMediaColor, bold: isNonZero } },
      {
        text: row.escola.participacao != null ? `${row.escola.participacao}%` : '—',
        options: {},
      },
      {
        text: row.rede.participacao != null ? `${row.rede.participacao}%` : '—',
        options: {},
      },
    ];
  });

  slide.addTable([headerRow, ...dataRows], {
    x: layout.x != null ? layout.x : 0.3,
    y: yOffset,
    w: layout.w != null ? layout.w : 9.4,
    fontSize: t.sizes ? t.sizes.tiny : 9,
    border: { type: 'solid', color: borderColor, pt: 1 },
    fill: { color: pptxHex(c.tableSurface || DEFAULT_THEME.colors.tableSurface) },
    fontFace: bodyFont,
  });
}

function addHabilidadesSlide(slide, data, theme) {
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);
  const tabela = (data.components || {}).tabela;
  const borderColor = pptxHex(c.tableBorder || DEFAULT_THEME.colors.tableBorder);
  const headerFill = pptxHex(c.tableHeader || DEFAULT_THEME.colors.tableHeader);
  const surfaceFill = pptxHex(c.tableSurface || DEFAULT_THEME.colors.tableSurface);

  const columnDefs = tabela
    ? tabela.columnDefs
    : [
      { key: 'codigo', label: 'Código' },
      { key: 'descricao', label: 'Descrição' },
      { key: 'percentualAcerto', label: '% Acerto' },
    ];

  const pageIndex = Number.isInteger(data.pageIndex) ? data.pageIndex : 0;
  const displayRows = tabela ? (tabela.pages[pageIndex] || tabela.pages[0] || []) : (data.rows || []);

  if (displayRows.length === 0) {
    addTextBlock(slide, 'Nenhuma habilidade disponível para esta área.', 1.0, th);
    return;
  }

  const totalPages = tabela ? tabela.totalPages : 1;
  const totalRows = tabela ? tabela.totalRows : displayRows.length;

  addContextStrip(slide, [
    { label: 'Área / Disciplina', value: data.disciplina || '—' },
    { label: 'Total de habilidades', value: String(totalRows) },
    { label: 'Paginação', value: `${pageIndex + 1} / ${totalPages}` },
  ], 1.02, th);

  const headerRow = columnDefs.map((col) => ({
    text: col.label,
    options: { bold: true, fill: headerFill },
  }));

  const dataRows = displayRows.map((row) => columnDefs.map((col) => {
    const isScoreColumn = col.key === 'percentualAcerto';
    const scoreFill = isScoreColumn && row._rowColor ? pptxHex(row._rowColor) : null;
    return {
      text: row[col.key] != null ? String(row[col.key]) : '—',
      options: scoreFill
        ? { fill: scoreFill, color: 'FFFFFF', bold: true }
        : col.key === 'codigo'
          ? { bold: true, color: pptxHex(c.primary) }
          : {},
    };
  }));

  if (tabela && tabela.totalPages > 1) {
    slide.addText(`${pageIndex + 1} / ${tabela.totalPages} páginas  •  ${tabela.totalRows} habilidades no total`, {
      x: 0.3,
      y: 1.62,
      w: 9,
      h: 0.25,
      fontSize: t.sizes ? t.sizes.tiny : 9,
      color: pptxHex(c.textMuted),
      italic: true,
      fontFace: bodyFont,
    });
  }

  slide.addTable([headerRow, ...dataRows], {
    x: 0.3,
    y: 1.95,
    w: 12.1,
    fontSize: t.sizes ? t.sizes.tiny : 9,
    border: { type: 'solid', color: borderColor, pt: 1 },
    fill: { color: surfaceFill },
    fontFace: bodyFont,
  });
}

function addCapaContent(slide, data, theme) {
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const displayFont = getDisplayFont(t);
  const bodyFont = getBodyFont(t);

  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 13.333,
    h: 2.15,
    fill: { color: pptxHex(c.openerBand || c.primary) },
    line: { color: pptxHex(c.openerBand || c.primary), pt: 0 },
  });
  slide.addShape('rect', {
    x: 0,
    y: 2.15,
    w: 13.333,
    h: 0.05,
    fill: { color: pptxHex(c.ruleStrong || c.accent) },
    line: { color: pptxHex(c.ruleStrong || c.accent), pt: 0 },
  });
  slide.addText('BOOK DE RESULTADOS', {
    x: 0.75,
    y: 1.15,
    w: 3.8,
    h: 0.2,
    fontSize: t.sizes ? t.sizes.tiny : 9,
    bold: true,
    color: 'FFFFFF',
    fontFace: bodyFont,
    charSpace: 2,
    margin: 0,
  });
  slide.addText('Dossiê Institucional da Avaliação Educacional', {
    x: 0.75,
    y: 1.42,
    w: 6.8,
    h: 0.25,
    fontSize: t.sizes ? t.sizes.heading : 16,
    bold: true,
    color: 'FFFFFF',
    fontFace: displayFont,
    margin: 0,
  });
  slide.addText('Relatório de Resultados da Avaliação', {
    x: 0.9,
    y: 2.8,
    w: 7.1,
    h: 0.65,
    fontSize: t.sizes ? t.sizes.coverTitle : 32,
    bold: true,
    color: pptxHex(c.primary),
    fontFace: displayFont,
    margin: 0,
  });
  slide.addText(data.municipio || '', {
    x: 0.9,
    y: 3.7,
    w: 4.6,
    h: 0.45,
    fontSize: 24,
    color: pptxHex(c.primary),
    fontFace: displayFont,
    margin: 0,
  });
  slide.addShape('roundRect', {
    x: 0.9,
    y: 4.4,
    w: 3.6,
    h: 0.32,
    rectRadius: 0.06,
    fill: { color: pptxHex(c.background) },
    line: { color: pptxHex(c.cardBorder), pt: 1 },
  });
  slide.addText([data.ano, data.ciclo].filter(Boolean).join(' • ') || 'Edição institucional', {
    x: 1.02,
    y: 4.49,
    w: 3.35,
    h: 0.12,
    fontSize: t.sizes ? t.sizes.small : 10,
    color: pptxHex(c.textSecondary),
    fontFace: bodyFont,
    margin: 0,
  });
  slide.addText(
    'Síntese editorial da rede com leitura de participação, proficiência, habilidades e recortes por escola.',
    {
      x: 0.9,
      y: 4.95,
      w: 5.9,
      h: 0.8,
      fontSize: t.sizes ? t.sizes.subheading : 13,
      color: pptxHex(c.textSecondary),
      fontFace: bodyFont,
      valign: 'mid',
      margin: 0,
    },
  );
}

function addCapituloContent(slide, data, theme) {
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const displayFont = getDisplayFont(t);
  const bodyFont = getBodyFont(t);
  const chapterIndex = Number(data.chapterIndex);
  const chapterLabel = Number.isInteger(chapterIndex) && chapterIndex > 0
    ? `CAPÍTULO ${String(chapterIndex).padStart(2, '0')}`
    : 'CAPÍTULO';

  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: pptxHex(c.paper || c.surface) },
    line: { color: pptxHex(c.paper || c.surface), pt: 0 },
  });
  slide.addText(chapterLabel, {
    x: 0.95,
    y: 1.55,
    w: 3.2,
    h: 0.18,
    fontSize: t.sizes ? t.sizes.tiny : 9,
    bold: true,
    color: pptxHex(c.accent),
    fontFace: bodyFont,
    charSpace: 2,
    margin: 0,
  });
  slide.addText(data.chapterTitle || data.title || '', {
    x: 0.95,
    y: 2.05,
    w: 8.8,
    h: 0.82,
    fontSize: t.sizes ? t.sizes.chapterTitle : 28,
    bold: true,
    color: pptxHex(c.primary),
    fontFace: displayFont,
    margin: 0,
  });
  slide.addText(data.summary || '', {
    x: 0.95,
    y: 3.15,
    w: 7.8,
    h: 0.95,
    fontSize: t.sizes ? t.sizes.subheading : 13,
    color: pptxHex(c.textSecondary),
    fontFace: bodyFont,
    valign: 'mid',
    margin: 0,
  });
  slide.addShape('rect', {
    x: 0.95,
    y: 4.38,
    w: 1.7,
    h: 0.05,
    fill: { color: pptxHex(c.ruleStrong || c.accent) },
    line: { color: pptxHex(c.ruleStrong || c.accent), pt: 0 },
  });
}

function addIndicatorCards(slide, charts, theme) {
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);
  const displayFont = getDisplayFont(t);
  const indicators = charts.filter((ch) => ch.type === 'indicator');
  const maxCardsPerRow = 5;
  const cardWidth = 2.35;
  const cardGap = 0.14;

  indicators.forEach((card, idx) => {
    if (idx >= maxCardsPerRow) return;
    const x = 0.3 + idx * (cardWidth + cardGap);
    slide.addShape('rect', {
      x,
      y: 1.02,
      w: cardWidth,
      h: 0.95,
      fill: { color: pptxHex(c.cardBackground) },
      line: { color: pptxHex(c.cardBorder), pt: 1 },
    });
    slide.addShape('rect', {
      x,
      y: 1.02,
      w: cardWidth,
      h: 0.04,
      fill: { color: pptxHex(c.accent) },
      line: { color: pptxHex(c.accent), pt: 0 },
    });
    slide.addText(String(card.valor), {
      x: x + 0.1,
      y: 1.14,
      w: cardWidth - 0.2,
      h: 0.28,
      fontSize: 18,
      bold: true,
      color: pptxHex(c.primary),
      align: 'left',
      fontFace: displayFont,
      margin: 0,
    });
    slide.addText(card.titulo, {
      x: x + 0.1,
      y: 1.53,
      w: cardWidth - 0.2,
      h: 0.16,
      fontSize: t.sizes ? t.sizes.tiny : 9,
      color: pptxHex(c.textSecondary),
      align: 'left',
      fontFace: bodyFont,
      margin: 0,
    });
  });
}

function addContextStrip(slide, items, yOffset, theme) {
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);
  const displayFont = getDisplayFont(t);
  const safeItems = (items || []).filter((item) => item && item.label);
  if (safeItems.length === 0) return;

  const x = 0.3;
  const w = 12.1;
  const h = 0.52;
  const cellWidth = w / safeItems.length;

  slide.addShape('roundRect', {
    x,
    y: yOffset,
    w,
    h,
    rectRadius: 0.04,
    fill: { color: pptxHex(c.tableHeader || c.background) },
    line: { color: pptxHex(c.tableBorder), pt: 1 },
  });

  safeItems.forEach((item, index) => {
    const itemX = x + index * cellWidth;
    if (index > 0) {
      slide.addShape('line', {
        x: itemX,
        y: yOffset + 0.08,
        w: 0,
        h: h - 0.16,
        line: { color: pptxHex(c.tableBorder), pt: 1 },
      });
    }
    slide.addText(item.label, {
      x: itemX + 0.12,
      y: yOffset + 0.08,
      w: cellWidth - 0.24,
      h: 0.12,
      fontSize: t.sizes ? t.sizes.tiny : 9,
      bold: true,
      color: pptxHex(c.textMuted),
      fontFace: bodyFont,
      margin: 0,
    });
    slide.addText(item.value || '—', {
      x: itemX + 0.12,
      y: yOffset + 0.23,
      w: cellWidth - 0.24,
      h: 0.16,
      fontSize: t.sizes ? t.sizes.small : 10,
      color: pptxHex(c.primary),
      fontFace: displayFont,
      margin: 0,
    });
  });
}

function addRedeResumoTable(slide, rows, theme, layout = {}) {
  if (!rows || rows.length === 0) return;
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);
  const headerFill = pptxHex(c.tableHeader);

  const tableRows = [
    [
      { text: 'Disciplina', options: { bold: true, fill: headerFill } },
      { text: 'Média da Rede', options: { bold: true, fill: headerFill } },
      { text: 'Participação', options: { bold: true, fill: headerFill } },
      { text: 'Escolas', options: { bold: true, fill: headerFill } },
    ],
    ...rows.map((row) => [
      row.disciplina || '—',
      row.media != null ? String(row.media) : '—',
      row.participacao != null ? `${row.participacao}%` : '—',
      row.escolas != null ? String(row.escolas) : '—',
    ]),
  ];

  slide.addTable(tableRows, {
    x: layout.x != null ? layout.x : 0.3,
    y: layout.y != null ? layout.y : 4.55,
    w: layout.w != null ? layout.w : 12.35,
    fontSize: t.sizes ? t.sizes.tiny : 9,
    border: { type: 'solid', color: pptxHex(c.tableBorder), pt: 1 },
    fill: { color: pptxHex(c.tableSurface) },
    fontFace: bodyFont,
  });
}

function addDistributionTable(slide, distribuicao, yOffset, theme, layout = {}) {
  if (!distribuicao) return;
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);

  const niveis = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
  const labels = {
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
      labels[nivel],
      String(distribuicao[nivel] || 0),
      `${(distribuicao.percentuais || {})[nivel] || 0}%`,
    ]),
  ];

  slide.addTable(rows, {
    x: layout.x != null ? layout.x : 0.3,
    y: yOffset,
    w: layout.w != null ? layout.w : 4,
    fontSize: t.sizes ? t.sizes.small : 10,
    border: { type: 'solid', color: pptxHex(c.tableBorder), pt: 1 },
    fill: { color: pptxHex(c.tableSurface) },
    fontFace: bodyFont,
  });
}

function addRankingTable(slide, rows, theme, layout = {}) {
  if (!rows || rows.length === 0) return;
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);
  const headerFill = pptxHex(c.tableHeader);

  const tableRows = [
    [
      { text: 'Pos.', options: { bold: true, fill: headerFill } },
      { text: 'Escola', options: { bold: true, fill: headerFill } },
      { text: 'Participação', options: { bold: true, fill: headerFill } },
      { text: 'Média', options: { bold: true, fill: headerFill } },
    ],
    ...rows.map((row) => [
      String(row.posicao),
      row.nome_escola || '',
      row.participacao != null ? `${row.participacao}%` : '—',
      String(row.media || 0),
    ]),
  ];

  slide.addTable(tableRows, {
    x: layout.x != null ? layout.x : 0.3,
    y: layout.y != null ? layout.y : 0.85,
    w: layout.w != null ? layout.w : 9,
    fontSize: t.sizes ? t.sizes.small : 10,
    border: { type: 'solid', color: pptxHex(c.tableBorder), pt: 1 },
    fill: { color: pptxHex(c.tableSurface) },
    fontFace: bodyFont,
  });
}

function addSumarioEntries(slide, entries, theme) {
  if (!entries || entries.length === 0) return;
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);

  const tableRows = entries.map((entry) => [entry.title, String(entry.page)]);

  slide.addTable(tableRows, {
    x: 0.5,
    y: 1.0,
    w: 12,
    fontSize: t.sizes ? t.sizes.body : 11,
    border: { type: 'solid', color: pptxHex(c.tableBorder), pt: 1 },
    fontFace: bodyFont,
  });
}

function addTextBlock(slide, text, yOffset, theme, layout = {}) {
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;

  slide.addText(text, {
    x: layout.x != null ? layout.x : 0.5,
    y: yOffset,
    w: layout.w != null ? layout.w : 9,
    h: layout.h != null ? layout.h : 3,
    fontSize: t.sizes ? t.sizes.body : 12,
    color: pptxHex(c.textPrimary),
    wrap: true,
    fontFace: getBodyFont(t),
  });
}

function addBulletList(slide, items, yOffset, theme, layout = {}) {
  if (!items || items.length === 0) return;
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;

  slide.addText(
    items.map((item) => `${String.fromCharCode(8226)} ${item}`).join('\n'),
    {
      x: layout.x != null ? layout.x : 0.8,
      y: yOffset,
      w: layout.w != null ? layout.w : 8.6,
      h: layout.h != null ? layout.h : 2.8,
      fontSize: t.sizes ? t.sizes.body : 12,
      color: pptxHex(c.textPrimary),
      breakLine: true,
      margin: 0.05,
      fontFace: getBodyFont(t),
    },
  );
}

function addSchoolComparativeTable(slide, rows, yOffset, xOffset = 4.5, width = 5, theme) {
  if (!rows || rows.length === 0) return;
  const th = theme || DEFAULT_THEME;
  const c = th.colors || DEFAULT_THEME.colors;
  const t = th.typography || DEFAULT_THEME.typography;
  const bodyFont = getBodyFont(t);

  const tableRows = [
    [
      { text: 'Área', options: { bold: true } },
      { text: 'Part. Escola', options: { bold: true } },
      { text: 'Part. Rede', options: { bold: true } },
      { text: 'Média', options: { bold: true } },
      { text: 'Δ Média', options: { bold: true } },
    ],
    ...rows.map((row) => [
      row.disciplina,
      row.participacaoEscola != null ? `${row.participacaoEscola}%` : '—',
      row.participacaoRede != null ? `${row.participacaoRede}%` : '—',
      row.mediaEscola != null ? String(row.mediaEscola) : '—',
      row.deltaMedia != null ? String(row.deltaMedia) : '—',
    ]),
  ];

  slide.addTable(tableRows, {
    x: xOffset,
    y: yOffset,
    w: width,
    fontSize: t.sizes ? t.sizes.tiny : 9,
    border: { type: 'solid', color: pptxHex(c.tableBorder), pt: 1 },
    fill: { color: pptxHex(c.tableSurface) },
    fontFace: bodyFont,
  });
}

function getBodyFont(typography = {}) {
  return typography.bodyFontFace || typography.fontFace || 'Calibri';
}

function getDisplayFont(typography = {}) {
  return typography.displayFontFace || typography.fontFace || getBodyFont(typography);
}

function findChart(charts, type) {
  return (charts || []).find((chart) => chart.type === type) || null;
}

const DEFAULT_BROWSER_PATHS = {
  win32: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  darwin: [
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ],
  linux: [
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ],
};

function resolvePdfBrowserPath(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.BOOK_DE_RESULTADOS_PDF_BROWSER,
    ...(DEFAULT_BROWSER_PATHS[process.platform] || []),
  ].filter(Boolean);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) return found;

  throw new Error(
    'Nenhum navegador compatível foi encontrado para exportação PDF. Informe options.browserPath ou defina BOOK_DE_RESULTADOS_PDF_BROWSER.',
  );
}

function printHtmlToPdf(browserPath, htmlPath, pdfPath) {
  const htmlUrl = pathToFileURL(htmlPath).href;
  const args = [
    '--headless=old',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=5000',
    `--print-to-pdf=${pdfPath}`,
    htmlUrl,
  ];

  return new Promise((resolve, reject) => {
    execFile(browserPath, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            `Falha ao gerar PDF com o navegador: ${stderr || stdout || error.message}`,
          ),
        );
        return;
      }

      resolve();
    });
  });
}

async function waitForFile(filePath, timeoutMs = 15000, intervalMs = 250) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Falha ao gerar o PDF: o arquivo "${filePath}" não foi criado dentro do tempo esperado`);
}

function sanitizeFilenameSegment(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

module.exports = {
  exportPptx,
  exportPdf,
  exportJson,
  buildOutputFilename,
  sanitizeFilenameSegment,
  resolvePdfBrowserPath,
  printHtmlToPdf,
  waitForFile,
  addSlide,
};
