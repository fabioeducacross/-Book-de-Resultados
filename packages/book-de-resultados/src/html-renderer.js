'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { DEFAULT_THEME, createTheme } = require('./theme');
const { buildPageChrome, resolvePageChromeSpec } = require('./chrome');
const {
  buildComparativoComponent,
  buildProficienciaComponent,
  buildHabilidadesTable,
} = require('./components');

function buildHtmlDocument(pages, chartsPerPage, metadata, options = {}) {
  const theme = createTheme(options.theme || {});
  const title = `Relatório de Resultados — ${metadata.municipio || ''} ${metadata.ano || ''}`.trim();
  const totalPages = Array.isArray(pages) ? pages.length : 0;
  const bodyAttributes = buildBodyAttributes(options.designManifest);
  const assetResolver = createAssetResolver(options.htmlOutputPath || null);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || 'Relatório de Resultados')}</title>
  <style>
    ${buildDocumentStyles(theme)}
  </style>
</head>
<body${bodyAttributes}>
  ${(pages || [])
      .map((page, index) =>
        renderPage(page, chartsPerPage[index] || [], theme, metadata, {
          totalPages,
          version: options.version || 'v1',
          assetResolver,
        }))
      .join('\n')}
</body>
</html>`;
}

function buildBodyAttributes(designManifest) {
  if (!designManifest || typeof designManifest !== 'object') {
    return '';
  }

  const attrs = [];

  if (designManifest.id) {
    attrs.push(` data-design-manifest-id="${escapeHtml(String(designManifest.id))}"`);
  }
  if (designManifest.manifestVersion) {
    attrs.push(` data-design-manifest-version="${escapeHtml(String(designManifest.manifestVersion))}"`);
  }
  if (designManifest.themeRef) {
    attrs.push(` data-design-theme-ref="${escapeHtml(String(designManifest.themeRef))}"`);
  }

  return attrs.join('');
}

function resolvePageStyleFlags(page = {}) {
  const layout = page.layout || {};
  return {
    styleRef: layout.styleRef || null,
    isDenseTable: layout.styleRef === 'dense-table',
  };
}

function buildDocumentStyles(theme) {
  const c = theme.colors || DEFAULT_THEME.colors;
  const t = theme.typography || DEFAULT_THEME.typography;
  const proficiency = c.proficiency || DEFAULT_THEME.colors.proficiency;
  const brandStrong = c.primary || c.brandPrimary || c.brandStrong || DEFAULT_THEME.colors.primary;
  const brandSoft = c.brandSoft || c.surface;
  const brandSecondary = c.secondary || c.brandSecondary || '#00A39E';
  const badgeColor = c.pageBadge || c.primary || c.brandPrimary || c.secondary;
  const badgeText = c.pageBadgeText || '#FFFFFF';
  const highlightSurface = c.highlightSurface || brandSoft;
  const highlightBorder = c.highlightBorder || c.cardBorder;
  const accentColor = c.brandYellow || c.accent || c.secondary || brandStrong;
  const bodyFontStack = String(
    t.htmlBodyStack || t.bodyFontFace || t.fontFace || DEFAULT_THEME.typography.fontFace,
  );
  const displayFontStack = String(
    t.htmlDisplayStack || t.displayFontFace || t.fontFace || DEFAULT_THEME.typography.fontFace,
  );

  return `
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: ${c.paper || c.background};
      color: ${c.textPrimary};
      font-family: ${bodyFontStack};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      padding: 16mm 14mm 12mm;
      page-break-after: always;
      background:
        radial-gradient(circle at top right, rgba(19, 180, 174, 0.16), transparent 34%),
        radial-gradient(circle at left 22%, rgba(255, 155, 92, 0.12), transparent 26%),
        linear-gradient(180deg, ${c.background} 0%, ${c.paper || c.surface} 100%);
      display: flex;
      flex-direction: column;
      gap: 4.6mm;
      overflow: hidden;
    }

    .page::before {
      content: '';
      position: absolute;
      inset: 7mm;
      border: 1px solid ${c.ruleSoft || c.tableBorder};
      border-radius: 8mm;
      pointer-events: none;
    }

    .page::after {
      content: '';
      position: absolute;
      width: 76mm;
      height: 76mm;
      right: -28mm;
      top: -24mm;
      border-radius: 50%;
      background: rgba(19, 180, 174, 0.12);
      pointer-events: none;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .page > * {
      position: relative;
      z-index: 1;
    }

    .cover-page,
    .chapter-page {
      padding: 0;
      gap: 0;
      background: ${c.background};
    }

    .cover-page::before,
    .cover-page::after,
    .chapter-page::before,
    .chapter-page::after {
      display: none;
    }

    .cover-page .page-header,
    .chapter-page .page-header,
    .cover-page .page-footer,
    .chapter-page .page-footer {
      display: none;
    }

    .page-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: flex-start;
      gap: 6mm;
    }

    .page-heading {
      display: flex;
      flex-direction: column;
      gap: 1.8mm;
      min-width: 0;
    }

    .page-eyebrow {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 1.5mm;
      padding: 1.2mm 4mm;
      border-radius: 999px;
      background: ${brandSoft};
      color: ${brandStrong};
      font-size: ${t.sizes.tiny || 9}pt;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .page-title {
      margin: 0;
      color: ${brandStrong};
      font-size: ${t.sizes.pageTitle || 18}pt;
      font-weight: 700;
      line-height: 1.08;
      font-family: ${displayFontStack};
      max-width: 132mm;
    }

    .page-subtitle {
      color: ${c.textSecondary};
      font-size: ${t.sizes.subheading || 12}pt;
      line-height: 1.45;
      max-width: 128mm;
    }

    .page-ranking-badge {
      display: inline-flex;
      align-self: flex-start;
      align-items: center;
      padding: 1.4mm 3.4mm;
      border-radius: 999px 999px 999px 0;
      background: ${highlightSurface};
      border: 1px solid ${highlightBorder};
      color: ${brandStrong};
      font-size: ${t.sizes.tiny || 9}pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .page-number {
      position: relative;
      min-width: 22mm;
      min-height: 22mm;
      padding: 2.6mm 2.4mm 2.2mm;
      border-radius: 7mm 7mm 2mm 7mm;
      background: ${badgeColor};
      color: ${badgeText};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.4mm;
      box-shadow: 0 1.8mm 4mm rgba(8, 74, 91, 0.12);
      text-align: center;
    }

    .page-number::after {
      content: '';
      position: absolute;
      bottom: -2.8mm;
      left: 6mm;
      width: 7mm;
      height: 7mm;
      background: ${badgeColor};
      transform: rotate(45deg);
      border-radius: 1.2mm;
    }

    .page-number-label,
    .page-number-value {
      position: relative;
      z-index: 1;
    }

    .page-number-label {
      font-size: ${t.sizes.tiny || 9}pt;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .page-number-value {
      font-family: ${displayFontStack};
      font-size: 16pt;
      font-weight: 700;
      line-height: 1;
    }

    .page-content {
      display: flex;
      flex-direction: column;
      gap: 4.4mm;
      min-height: 0;
      flex: 1;
    }

    .page-footer {
      margin-top: auto;
      border: 1px solid ${c.ruleSoft || c.tableBorder};
      background: rgba(255, 255, 255, 0.92);
      border-radius: 999px;
      padding: 2.2mm 3.4mm;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 3mm;
      align-items: center;
      color: ${c.textMuted};
      font-size: ${t.sizes.tiny || 9}pt;
    }

    .page-footer-center {
      text-align: center;
    }

    .page-footer-right {
      text-align: right;
      white-space: nowrap;
    }

    .indicator-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4mm;
    }

    .indicator-card {
      position: relative;
      border: 1px solid ${c.cardBorder};
      background: ${c.cardBackground};
      border-radius: 6mm;
      padding: 5.2mm 4mm 4mm;
      min-height: 27mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      text-align: left;
      overflow: hidden;
      box-shadow: 0 1mm 2.4mm rgba(8, 74, 91, 0.04);
    }

    .indicator-card::before {
      content: '';
      position: absolute;
      inset: 0;
      height: 2mm;
      background: linear-gradient(90deg, ${badgeColor}, ${accentColor});
    }

    .indicator-card .value {
      color: ${brandStrong};
      font-size: 17pt;
      font-weight: 700;
      line-height: 1.1;
      font-family: ${displayFontStack};
    }

    .indicator-card .label {
      margin-top: 2.4mm;
      color: ${c.textSecondary};
      font-size: ${t.sizes.tiny || 9}pt;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .panel {
      border: 1px solid ${c.tableBorder};
      background: ${c.tableSurface};
      border-radius: 6mm;
      padding: 4mm;
      box-shadow: 0 1mm 2mm rgba(8, 74, 91, 0.035);
    }

    .panel-title {
      margin: 0 0 3mm;
      color: ${brandStrong};
      font-size: ${t.sizes.heading || 15}pt;
      font-weight: 700;
      font-family: ${displayFontStack};
    }

    .chart-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4mm;
    }

    .analytic-split {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      gap: 4mm;
      align-items: start;
    }

    .analytic-split > div {
      display: flex;
      flex-direction: column;
      gap: 4mm;
      min-width: 0;
    }

    .chart-panel {
      border: 1px solid ${c.tableBorder};
      background: linear-gradient(180deg, ${c.surface} 0%, ${c.background} 100%);
      border-radius: 6mm;
      padding: 4mm;
    }

    .chart-title {
      margin: 0 0 2.5mm;
      color: ${brandStrong};
      font-size: ${t.sizes.subheading || 12}pt;
      font-weight: 700;
      font-family: ${displayFontStack};
    }

    .distribution-stack {
      display: flex;
      min-height: 11mm;
      border-radius: 999px;
      overflow: hidden;
      border: 1px solid ${c.tableBorder};
      background: ${c.surface};
    }

    .distribution-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: ${t.sizes.tiny || 9}pt;
      font-weight: 700;
      min-width: 8mm;
      padding: 1mm 0.6mm;
      text-align: center;
    }

    .distribution-legend {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2mm 4mm;
      margin-top: 3mm;
    }

    .distribution-legend-item {
      display: flex;
      align-items: center;
      gap: 2mm;
      font-size: ${t.sizes.tiny || 9}pt;
      color: ${c.textSecondary};
    }

    .legend-swatch {
      width: 4mm;
      height: 4mm;
      border-radius: 999px;
      flex-shrink: 0;
    }

    .ranking-chart-row,
    .comparativo-chart-row {
      display: grid;
      grid-template-columns: minmax(24mm, 1fr) minmax(0, 2.2fr) auto;
      gap: 3mm;
      align-items: center;
      margin-bottom: 2.5mm;
    }

    .ranking-label,
    .comparativo-label {
      font-size: ${t.sizes.tiny || 9}pt;
      color: ${c.textPrimary};
      font-weight: 700;
    }

    .chart-track {
      width: 100%;
      background: ${c.tableHeader};
      border-radius: 999px;
      min-height: 4.8mm;
      overflow: hidden;
    }

    .chart-bar {
      min-height: 4.8mm;
      border-radius: 999px;
    }

    .chart-value {
      color: ${c.textSecondary};
      font-size: ${t.sizes.tiny || 9}pt;
      white-space: nowrap;
    }

    .comparativo-bars {
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
    }

    .comparativo-bar-line {
      display: grid;
      grid-template-columns: 14mm minmax(0, 1fr);
      gap: 2mm;
      align-items: center;
    }

    .comparativo-bar-line .series-label {
      color: ${c.textMuted};
      font-size: ${t.sizes.tiny || 9}pt;
    }

    .comparativo-delta {
      font-weight: 700;
    }

    .text-block {
      margin: 0;
      color: ${c.textPrimary};
      font-size: ${t.sizes.body || 11}pt;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .cover-hero {
      min-height: 297mm;
      display: grid;
      grid-template-rows: 88mm 1.8mm 1fr;
      background: linear-gradient(155deg, ${brandStrong} 0 32%, ${c.background} 32% 100%);
      position: relative;
      overflow: hidden;
    }

    .cover-band {
      background: transparent;
      color: #ffffff;
      padding: 20mm 18mm 12mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 4.6mm;
      position: relative;
      overflow: hidden;
    }

    .cover-band::after {
      content: '';
      position: absolute;
      width: 78mm;
      height: 78mm;
      border-radius: 50%;
      right: -18mm;
      top: -16mm;
      background: rgba(255, 255, 255, 0.12);
    }

    .cover-rule,
    .chapter-divider {
      background: ${c.ruleStrong || accentColor};
      height: 1.8mm;
      width: 100%;
    }

    .cover-kicker,
    .chapter-marker {
      color: ${accentColor};
      font-size: ${t.sizes.tiny || 9}pt;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }

    .cover-band .cover-kicker {
      color: rgba(255, 255, 255, 0.78);
    }

    .cover-band-title {
      margin: 0;
      font-family: ${displayFontStack};
      font-size: ${t.sizes.heading || 15}pt;
      font-weight: 700;
      line-height: 1.2;
      max-width: 95mm;
    }

    .cover-body {
      padding: 14mm 18mm 18mm;
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(66mm, 0.8fr);
      gap: 10mm;
      align-items: start;
    }

    .cover-title,
    .chapter-title {
      margin: 0;
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-weight: 700;
      line-height: 1.05;
    }

    .cover-title {
      font-size: ${t.sizes.coverTitle || 34}pt;
    }

    .chapter-title {
      font-size: ${t.sizes.chapterTitle || 30}pt;
    }

    .cover-city {
      margin: 0;
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: 22pt;
      line-height: 1.08;
    }

    .cover-edition {
      display: inline-flex;
      align-items: center;
      border: 1px solid ${highlightBorder};
      color: ${brandStrong};
      background: ${highlightSurface};
      padding: 1.6mm 3.4mm;
      border-radius: 999px;
      font-size: ${t.sizes.small || 10}pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .cover-meta-copy,
    .chapter-summary {
      margin: 0;
      color: ${c.textSecondary};
      font-size: ${t.sizes.subheading || 12}pt;
      line-height: 1.6;
      max-width: 108mm;
    }

    .cover-media-stack {
      min-height: 122mm;
      border: 1px solid ${c.ruleSoft || c.tableBorder};
      background: linear-gradient(180deg, rgba(19, 61, 89, 0.05) 0%, rgba(255, 255, 255, 0.96) 100%);
      padding: 8mm;
      border-radius: 8mm 8mm 8mm 0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .cover-media-stack::before {
      content: '';
      position: absolute;
      inset: auto -20mm -18mm auto;
      width: 70mm;
      height: 70mm;
      border-radius: 50%;
      background: rgba(255, 155, 92, 0.16);
    }

    .cover-image {
      max-width: 100%;
      max-height: 96mm;
      object-fit: contain;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    .chapter-hero {
      min-height: 297mm;
      padding: 24mm 18mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 5mm;
      background: linear-gradient(180deg, ${c.paper || c.surface} 0%, ${c.background} 100%);
      position: relative;
      overflow: hidden;
    }

    .chapter-hero::before {
      content: '';
      position: absolute;
      width: 92mm;
      height: 92mm;
      right: -18mm;
      bottom: -20mm;
      border-radius: 50%;
      background: rgba(19, 180, 174, 0.14);
    }

    .chapter-divider {
      width: 50mm;
    }

    .context-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 3mm;
    }

    .context-item {
      border: 1px solid ${c.cardBorder};
      background: ${c.cardBackground};
      border-radius: 5mm;
      padding: 3.2mm 3.2mm;
      min-height: 17mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1mm;
    }

    .context-item-label {
      color: ${c.textMuted};
      font-size: ${t.sizes.tiny || 9}pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .context-item-value {
      color: ${brandStrong};
      font-size: ${t.sizes.subheading || 12}pt;
      font-weight: 700;
      font-family: ${displayFontStack};
    }

    table.data-table,
    .summary-table,
    .skills-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: ${t.sizes.small || 10}pt;
      background: ${c.tableSurface};
    }

    table.data-table th,
    table.data-table td,
    .summary-table th,
    .summary-table td,
    .skills-table th,
    .skills-table td {
      border: 1px solid ${c.tableBorder};
      padding: 2.2mm 2mm;
      vertical-align: top;
      word-break: break-word;
    }

    table.data-table th,
    .summary-table th,
    .skills-table th {
      background: ${c.tableHeader};
      color: ${brandStrong};
      font-weight: 700;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      font-size: ${t.sizes.tiny || 9}pt;
    }

    .summary-table td:last-child,
    .summary-table td:nth-child(2),
    .summary-table td:nth-child(3),
    .skills-table td:last-child {
      text-align: right;
    }

    .level-cell {
      color: #ffffff;
      font-weight: 700;
    }

    .delta-positive {
      color: ${c.deltaPositive};
      font-weight: 700;
    }

    .delta-negative {
      color: ${c.deltaNegative};
      font-weight: 700;
    }

    .delta-neutral {
      color: ${c.deltaNeutral};
    }

    .muted {
      color: ${c.textMuted};
      font-size: ${t.sizes.tiny || 9}pt;
    }

    .bullet-list {
      margin: 0;
      padding-left: 6mm;
      color: ${c.textPrimary};
      font-size: ${t.sizes.body || 11}pt;
      line-height: 1.5;
    }

    .skill-score-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18mm;
      padding: 1mm 2.2mm;
      border-radius: 999px;
      color: #ffffff;
      font-weight: 700;
      font-size: ${t.sizes.tiny || 9}pt;
    }

    .skill-code {
      font-weight: 700;
      color: ${brandStrong};
      width: 22mm;
    }

    .hero-panel {
      border: 1px solid ${c.cardBorder};
      background: linear-gradient(135deg, ${brandSoft} 0%, ${c.background} 100%);
      border-radius: 8mm 8mm 8mm 0;
      padding: 5mm 5.2mm;
      display: flex;
      flex-direction: column;
      gap: 3.2mm;
    }

    .hero-panel-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4mm;
      align-items: start;
    }

    .hero-panel-main {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2mm;
    }

    .hero-panel-kicker {
      align-self: flex-start;
      padding: 1.2mm 3.2mm;
      border-radius: 999px;
      border: 1px solid rgba(10, 86, 115, 0.14);
      background: rgba(255, 255, 255, 0.72);
      color: ${brandStrong};
      font-size: ${t.sizes.tiny || 9}pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .hero-panel-emphasis {
      min-width: 35mm;
      display: flex;
      flex-direction: column;
      gap: 1mm;
      padding: 3.4mm 3.6mm;
      border-radius: 5mm;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(10, 86, 115, 0.1);
      text-align: right;
    }

    .hero-panel-emphasis-label {
      color: ${c.textMuted};
      font-size: ${t.sizes.tiny || 9}pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .hero-panel-emphasis-value {
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: ${t.sizes.pageTitle || 18}pt;
      font-weight: 700;
      line-height: 1;
    }

    .hero-panel-emphasis-note,
    .hero-panel-footnote {
      color: ${c.textSecondary};
      font-size: ${t.sizes.small || 10}pt;
      line-height: 1.35;
    }

    .hero-panel-overview {
      background: linear-gradient(135deg, rgba(16, 179, 173, 0.18) 0%, rgba(255, 255, 255, 0.94) 100%);
    }

    .hero-panel-discipline {
      background: linear-gradient(135deg, rgba(123, 103, 215, 0.12) 0%, rgba(255, 255, 255, 0.96) 100%);
    }

    .hero-panel-title {
      margin: 0;
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: ${t.sizes.heading || 15}pt;
      line-height: 1.1;
    }

    .hero-panel-copy {
      margin: 0;
      color: ${c.textSecondary};
      font-size: ${t.sizes.body || 11}pt;
      line-height: 1.55;
    }

    .hero-kpi-row {
      display: flex;
      flex-wrap: wrap;
      gap: 2.2mm;
    }

    .hero-kpi-chip,
    .metric-chip,
    .score-pill {
      display: inline-flex;
      align-items: center;
      gap: 1.4mm;
      padding: 1.4mm 3mm;
      border-radius: 999px;
      border: 1px solid ${c.cardBorder};
      background: rgba(255, 255, 255, 0.92);
      color: ${brandStrong};
      font-size: ${t.sizes.tiny || 9}pt;
      line-height: 1.2;
    }

    .hero-kpi-chip strong,
    .metric-chip strong,
    .score-pill strong {
      font-family: ${displayFontStack};
      font-size: ${t.sizes.small || 10}pt;
      color: ${brandStrong};
    }

    .summary-callout {
      border-radius: 6mm;
      border: 1px solid ${highlightBorder};
      background: ${highlightSurface};
      padding: 4mm;
      color: ${brandStrong};
      font-size: ${t.sizes.body || 11}pt;
      line-height: 1.55;
    }

    .priority-template {
      display: flex;
      flex-direction: column;
      gap: 4mm;
      min-height: 0;
    }

    .priority-context-band {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 3mm;
    }

    .priority-context-card {
      display: flex;
      flex-direction: column;
      gap: 1mm;
      padding: 3.2mm 3.6mm;
      border-radius: 5mm;
      border: 1px solid rgba(10, 86, 115, 0.08);
      background: rgba(255, 255, 255, 0.88);
    }

    .priority-context-label {
      color: ${c.textMuted};
      font-size: ${t.sizes.tiny || 9}pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .priority-context-value {
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: ${t.sizes.subheading || 12}pt;
      line-height: 1.2;
    }

    .overview-indicator-grid,
    .discipline-indicator-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .analytic-split[data-layout="network-overview-shell"],
    .analytic-split[data-layout="discipline-results-shell"] {
      gap: 3.6mm;
    }

    .section-visao_geral .priority-template,
    .section-resultados_disciplina .priority-template {
      gap: 3.8mm;
    }

    .section-visao_geral .summary-callout,
    .section-resultados_disciplina .summary-callout {
      min-height: 100%;
    }

    .section-visao_geral .hero-panel-overview,
    .section-resultados_disciplina .hero-panel-discipline {
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(19, 61, 89, 0.12);
      border-radius: 3.2mm;
      padding: 4.6mm 4.8mm 4.2mm;
    }

    .section-visao_geral .hero-panel-overview {
      background: linear-gradient(180deg, rgba(19, 61, 89, 0.06) 0%, rgba(255, 255, 255, 0.98) 38%, #FFFFFF 100%);
    }

    .section-resultados_disciplina .hero-panel-discipline {
      background: linear-gradient(180deg, rgba(107, 77, 167, 0.07) 0%, rgba(255, 255, 255, 0.98) 36%, #FFFFFF 100%);
    }

    .section-visao_geral .hero-panel-overview::before,
    .section-resultados_disciplina .hero-panel-discipline::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1.3mm;
      background: ${brandStrong};
    }

    .section-resultados_disciplina .hero-panel-discipline::before {
      background: ${c.brandPurple || accentColor};
    }

    .section-visao_geral .hero-panel-kicker,
    .section-resultados_disciplina .hero-panel-kicker {
      padding: 0;
      border: none;
      border-radius: 0;
      background: transparent;
      color: ${c.textMuted};
      letter-spacing: 0.16em;
    }

    .section-visao_geral .hero-panel-grid,
    .section-resultados_disciplina .hero-panel-grid {
      grid-template-columns: minmax(0, 1fr) 34mm;
      gap: 3mm;
      align-items: end;
    }

    .section-visao_geral .hero-panel-main,
    .section-resultados_disciplina .hero-panel-main {
      gap: 1.4mm;
    }

    .section-visao_geral .hero-panel-title,
    .section-resultados_disciplina .hero-panel-title {
      font-size: 16pt;
      line-height: 1.02;
      letter-spacing: -0.02em;
      max-width: 92mm;
    }

    .section-visao_geral .hero-panel-copy,
    .section-resultados_disciplina .hero-panel-copy {
      max-width: 96mm;
      font-size: 9.6pt;
      line-height: 1.52;
    }

    .section-visao_geral .hero-panel-emphasis,
    .section-resultados_disciplina .hero-panel-emphasis {
      min-width: 0;
      gap: 0.8mm;
      padding: 2.8mm 3.1mm;
      border-radius: 2.6mm;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(19, 61, 89, 0.08);
      text-align: right;
      align-self: stretch;
      justify-content: center;
    }

    .section-visao_geral .hero-panel-emphasis-label,
    .section-resultados_disciplina .hero-panel-emphasis-label {
      font-size: 7pt;
      letter-spacing: 0.12em;
    }

    .section-visao_geral .hero-panel-emphasis-value,
    .section-resultados_disciplina .hero-panel-emphasis-value {
      font-size: 16pt;
    }

    .section-visao_geral .hero-panel-emphasis-note,
    .section-resultados_disciplina .hero-panel-emphasis-note,
    .section-visao_geral .hero-panel-footnote,
    .section-resultados_disciplina .hero-panel-footnote {
      font-size: 7.8pt;
      line-height: 1.3;
    }

    .section-visao_geral .hero-kpi-row,
    .section-resultados_disciplina .hero-kpi-row {
      gap: 1.6mm;
      padding-top: 0.6mm;
    }

    .section-visao_geral .hero-kpi-chip,
    .section-resultados_disciplina .hero-kpi-chip {
      gap: 1.2mm;
      padding: 1.1mm 2.6mm;
      border-radius: 2.4mm;
      border-color: rgba(19, 61, 89, 0.1);
      background: rgba(255, 255, 255, 0.96);
      font-size: 7.6pt;
    }

    .section-visao_geral .hero-kpi-chip strong,
    .section-resultados_disciplina .hero-kpi-chip strong {
      font-size: 8.6pt;
    }

    .section-visao_geral .priority-context-band,
    .section-resultados_disciplina .priority-context-band {
      gap: 0;
      border-top: 1px solid #D9DFDE;
      border-bottom: 1px solid #D9DFDE;
      background: rgba(248, 249, 246, 0.96);
    }

    .section-visao_geral .priority-context-card,
    .section-resultados_disciplina .priority-context-card {
      gap: 0.7mm;
      padding: 2.8mm 3mm;
      border: none;
      border-radius: 0;
      background: transparent;
    }

    .section-visao_geral .priority-context-card + .priority-context-card,
    .section-resultados_disciplina .priority-context-card + .priority-context-card {
      border-left: 1px solid #E0E5E3;
    }

    .section-visao_geral .priority-context-label,
    .section-resultados_disciplina .priority-context-label {
      font-size: 7.2pt;
      letter-spacing: 0.12em;
    }

    .section-visao_geral .priority-context-value,
    .section-resultados_disciplina .priority-context-value {
      font-size: 10.2pt;
      line-height: 1.15;
    }

    .section-visao_geral .overview-indicator-grid,
    .section-resultados_disciplina .discipline-indicator-grid {
      gap: 2.4mm;
    }

    .section-visao_geral .indicator-card,
    .section-resultados_disciplina .indicator-card {
      min-height: 22mm;
      padding: 4.1mm 3.4mm 3.2mm;
      border-radius: 2.8mm;
      border-color: #D8DEDC;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 246, 243, 0.96) 100%);
    }

    .section-visao_geral .indicator-card::before,
    .section-resultados_disciplina .indicator-card::before {
      height: 1.1mm;
      background: linear-gradient(90deg, ${brandStrong}, ${accentColor});
    }

    .section-resultados_disciplina .indicator-card::before {
      background: linear-gradient(90deg, ${c.brandPurple || brandStrong}, ${accentColor});
    }

    .section-visao_geral .indicator-card .value,
    .section-resultados_disciplina .indicator-card .value {
      font-size: 16pt;
      line-height: 1;
    }

    .section-visao_geral .indicator-card .label,
    .section-resultados_disciplina .indicator-card .label {
      font-size: 7.8pt;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: ${c.textSecondary};
    }

    .section-visao_geral .analytic-split[data-layout="network-overview-shell"],
    .section-resultados_disciplina .analytic-split[data-layout="discipline-results-shell"] {
      grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
      gap: 3mm;
    }

    .section-visao_geral .chart-panel,
    .section-visao_geral .panel,
    .section-resultados_disciplina .chart-panel,
    .section-resultados_disciplina .panel {
      border-radius: 3mm;
      padding: 3.4mm 3.6mm;
      border-color: #D8DEDC;
      background: #FFFFFF;
    }

    .section-visao_geral .chart-title,
    .section-resultados_disciplina .chart-title,
    .section-visao_geral .panel-title,
    .section-resultados_disciplina .panel-title {
      margin-bottom: 2mm;
      font-size: 10.4pt;
      line-height: 1.2;
    }

    .section-visao_geral .summary-callout,
    .section-resultados_disciplina .summary-callout {
      border-radius: 3mm;
      border: 1px solid #D8DEDC;
      border-left: 1.4mm solid ${brandStrong};
      background: linear-gradient(180deg, rgba(248, 249, 246, 0.98) 0%, rgba(255, 255, 255, 1) 100%);
      padding: 3.5mm 3.8mm;
      font-size: 9.4pt;
      line-height: 1.52;
    }

    .section-resultados_disciplina .summary-callout {
      border-left-color: ${c.brandPurple || accentColor};
    }
    .layout-style-analytic-overview.section-visao_geral .hero-panel-overview {
      border-color: rgba(7, 43, 69, 0.3);
      background:
        radial-gradient(circle at 12% 18%, rgba(255, 196, 73, 0.24) 0%, rgba(255, 196, 73, 0) 22%),
        radial-gradient(circle at 88% 16%, rgba(60, 185, 196, 0.24) 0%, rgba(60, 185, 196, 0) 28%),
        linear-gradient(135deg, #0A3554 0%, #0E5673 52%, #0F6F87 100%);
      box-shadow: 0 3.2mm 8mm rgba(8, 41, 63, 0.18);
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-overview::before {
      height: 2.4mm;
      background: linear-gradient(90deg, ${accentColor}, #FFD36A 52%, #FFFFFF 100%);
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-kicker,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-title,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-copy,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-overview .page-subtitle,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-footnote {
      color: #F7FBFC;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-kicker {
      color: #FFD36A;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-copy,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-overview .page-subtitle {
      color: rgba(247, 251, 252, 0.88);
    }

    .layout-style-analytic-overview.section-visao_geral .hero-kpi-chip {
      border-color: rgba(255, 255, 255, 0.14);
      background: rgba(8, 39, 61, 0.26);
      color: rgba(247, 251, 252, 0.92);
      box-shadow: inset 0 0 0 0.2mm rgba(255, 255, 255, 0.08);
    }

    .layout-style-analytic-overview.section-visao_geral .hero-kpi-chip strong {
      color: #FFFFFF;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-emphasis {
      background: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(243, 249, 250, 0.98) 100%);
      border-color: rgba(255, 211, 106, 0.56);
      box-shadow:
        0 2.2mm 5mm rgba(4, 25, 40, 0.16),
        inset 0 0 0 0.3mm rgba(255, 255, 255, 0.7);
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-emphasis-label {
      color: ${brandStrong};
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-emphasis-value {
      font-size: 19pt;
      color: #0A3554;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-emphasis-note {
      color: ${c.textSecondary};
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-band {
      border-top-color: rgba(7, 43, 69, 0.24);
      border-bottom-color: rgba(7, 43, 69, 0.24);
      background: linear-gradient(90deg, #113C5C 0%, #1A4E6B 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -1px 0 rgba(255, 255, 255, 0.08);
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-card + .priority-context-card {
      border-left-color: rgba(255, 255, 255, 0.12);
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-label {
      color: rgba(212, 230, 235, 0.76);
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-value {
      color: #FFFFFF;
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-card-referencia {
      background: linear-gradient(180deg, rgba(255, 211, 106, 0.12) 0%, rgba(255, 211, 106, 0.03) 100%);
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-card-referencia .priority-context-label,
    .layout-style-analytic-overview.section-visao_geral .priority-context-card-referencia .priority-context-value {
      color: #FFE7A6;
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-card-referencia .priority-context-value {
      font-size: 9.2pt;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .layout-style-analytic-overview.section-visao_geral .indicator-card-total-escolas,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-total-estudantes {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 245, 0.94) 100%);
      border-color: rgba(19, 61, 89, 0.1);
      box-shadow: 0 1.2mm 3mm rgba(8, 59, 89, 0.04);
    }

    .layout-style-analytic-overview.section-visao_geral .indicator-card-participacao-media,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-media-geral {
      border-color: rgba(7, 43, 69, 0.18);
      background: linear-gradient(135deg, #0C4B66 0%, #126D81 100%);
      box-shadow: 0 2.4mm 5.6mm rgba(9, 56, 84, 0.18);
      transform: translateY(-1.2mm);
    }

    .layout-style-analytic-overview.section-visao_geral .indicator-card-participacao-media::before,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-media-geral::before {
      height: 2mm;
      background: linear-gradient(90deg, ${accentColor}, #FFD36A 100%);
    }

    .layout-style-analytic-overview.section-visao_geral .indicator-card-participacao-media .value,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-media-geral .value {
      font-size: 19.5pt;
      color: #FFFFFF;
    }

    .layout-style-analytic-overview.section-visao_geral .indicator-card-participacao-media .label,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-media-geral .label {
      color: rgba(236, 246, 247, 0.92);
    }

    .layout-style-analytic-overview.section-visao_geral .analytic-split[data-layout="network-overview-shell"] > .overview-shell-main,
    .layout-style-analytic-overview.section-visao_geral .analytic-split[data-layout="network-overview-shell"] > .overview-shell-aside {
      display: flex;
      flex-direction: column;
      gap: 3mm;
      min-width: 0;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-shell-aside {
      padding: 2.2mm;
      border-radius: 3.2mm;
      background: linear-gradient(180deg, rgba(12, 75, 102, 0.08) 0%, rgba(12, 75, 102, 0.02) 100%);
    }

    .layout-style-analytic-overview.section-visao_geral .chart-panel-overview-distribution,
    .layout-style-analytic-overview.section-visao_geral .panel-overview-proficiencia,
    .layout-style-analytic-overview.section-visao_geral .panel-overview-discipline-summary,
    .layout-style-analytic-overview.section-visao_geral .panel-overview-summary {
      border-color: rgba(19, 61, 89, 0.12);
      box-shadow: 0 2mm 4.4mm rgba(8, 59, 89, 0.08);
    }

    .layout-style-analytic-overview.section-visao_geral .chart-panel-overview-distribution {
      background: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(245, 250, 250, 0.98) 100%);
    }

    .layout-style-analytic-overview.section-visao_geral .chart-panel-overview-distribution .distribution-stack {
      margin-bottom: 2.4mm;
      box-shadow: inset 0 0 0 0.25mm rgba(7, 43, 69, 0.06);
    }

    .layout-style-analytic-overview.section-visao_geral .chart-panel-overview-distribution .distribution-legend {
      gap: 1.8mm;
    }

    .layout-style-analytic-overview.section-visao_geral .panel-overview-proficiencia,
    .layout-style-analytic-overview.section-visao_geral .panel-overview-discipline-summary {
      background: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(247, 249, 248, 0.98) 100%);
    }

    .layout-style-analytic-overview.section-visao_geral .panel-overview-summary {
      background: linear-gradient(135deg, #0A3554 0%, #0E5673 100%);
      border-color: rgba(7, 43, 69, 0.24);
      box-shadow: 0 2.4mm 6mm rgba(8, 41, 63, 0.12);
    }

    .layout-style-analytic-overview.section-visao_geral .panel-overview-summary .panel-title {
      color: #FFFFFF;
    }

    .layout-style-analytic-overview.section-visao_geral .summary-callout-overview {
      border-left-width: 2.2mm;
      border-left-color: #FFD36A;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 250, 250, 0.98) 100%);
      box-shadow: inset 0 0 0 0.25mm rgba(7, 43, 69, 0.05);
    }

    .school-discipline-grid,
    .area-card-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 3mm;
    }

    .school-discipline-card,
    .area-card {
      border: 1px solid ${c.cardBorder};
      background: rgba(255, 255, 255, 0.98);
      border-radius: 6mm;
      padding: 3.6mm;
      display: flex;
      flex-direction: column;
      gap: 2.2mm;
      min-width: 0;
    }

    .school-discipline-header,
    .area-card-eyebrow {
      color: ${c.textMuted};
      font-size: ${t.sizes.tiny || 9}pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .school-discipline-title,
    .area-card-title {
      margin: 0;
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: ${t.sizes.subheading || 12}pt;
      line-height: 1.15;
    }

    .school-discipline-metrics,
    .area-card-scores {
      display: flex;
      flex-wrap: wrap;
      gap: 1.6mm;
    }

    .score-pill-network {
      background: rgba(31, 167, 217, 0.1);
    }

    .score-pill-school {
      background: rgba(78, 195, 140, 0.12);
    }

    .score-pill-delta {
      background: ${highlightSurface};
    }

    .mini-distribution {
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
    }

    .mini-distribution-row {
      display: flex;
      min-height: 6mm;
      border-radius: 999px;
      overflow: hidden;
      background: ${c.tableHeader};
    }

    .mini-distribution-fill {
      min-width: 4mm;
      height: 100%;
    }

    .mini-distribution-legend,
    .area-card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1.6mm 2.4mm;
      color: ${c.textSecondary};
      font-size: ${t.sizes.tiny || 9}pt;
    }

    .narrative-flow {
      display: flex;
      flex-direction: column;
      gap: 4mm;
    }

    .proficiency-abaixo_do_basico {
      background: ${proficiency.abaixo_do_basico};
    }

    .proficiency-basico {
      background: ${proficiency.basico};
    }

    .proficiency-adequado {
      background: ${proficiency.adequado};
    }

    .proficiency-avancado {
      background: ${proficiency.avancado};
    }

    .section-escola_disciplinas .chart-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .section-escola_disciplinas .data-table td:nth-child(2),
    .section-escola_disciplinas .data-table td:nth-child(3),
    .section-escola_disciplinas .data-table td:nth-child(5),
    .section-escola_disciplinas .data-table td:nth-child(6) {
      text-align: right;
    }

    .section-escola_disciplinas .reference-school-area {
      gap: 6.2mm;
      padding-top: 2mm;
    }

    .section-escola_disciplinas .reference-school-area-grid {
      gap: 5.4mm;
      padding: 2mm 0 1mm;
      align-items: start;
    }

    .section-escola_disciplinas .reference-school-area-grid::before {
      width: 1px;
      background: linear-gradient(180deg, rgba(19, 61, 89, 0) 0%, rgba(19, 61, 89, 0.18) 12%, rgba(19, 61, 89, 0.18) 88%, rgba(19, 61, 89, 0) 100%);
    }

    .section-escola_disciplinas .reference-area-card {
      padding: 2.4mm 4.2mm 0;
      gap: 5.2mm;
    }

    .section-escola_disciplinas .reference-area-card-head {
      gap: 2.4mm;
      align-items: center;
      padding-bottom: 1.2mm;
      border-bottom: 1px solid #E1E5E2;
    }

    .section-escola_disciplinas .reference-area-icon {
      width: 8.4mm;
      height: 8.4mm;
      border-radius: 1.6mm;
    }

    .section-escola_disciplinas .reference-area-chip {
      padding: 1.1mm 3.2mm;
      border-radius: 2mm;
      font-size: 7.4pt;
      letter-spacing: 0.08em;
    }

    .section-escola_disciplinas .reference-distribution-block {
      grid-template-columns: 16mm minmax(0, 1fr);
      gap: 2.2mm;
      align-items: start;
    }

    .section-escola_disciplinas .reference-distribution-label {
      padding-top: 1.2mm;
      font-size: 10.8pt;
      line-height: 1.04;
      letter-spacing: -0.02em;
    }

    .section-escola_disciplinas .reference-distribution-body {
      gap: 1.2mm;
    }

    .section-escola_disciplinas .reference-distribution-axis {
      padding: 0 0.4mm;
      color: #A0A8AF;
      font-size: 6.1pt;
    }

    .section-escola_disciplinas .reference-distribution-track {
      min-height: 8.4mm;
      border-left-width: 1.4px;
      border-radius: 1.2mm;
      background: #EDF1EF;
    }

    .section-escola_disciplinas .reference-distribution-track::before {
      left: -2.6mm;
      width: 2.6mm;
      height: 0.8mm;
    }

    .section-escola_disciplinas .reference-distribution-stats {
      gap: 0.6mm;
      padding-top: 0.4mm;
    }

    .section-escola_disciplinas .reference-distribution-stat {
      justify-content: flex-start;
      color: #6F7881;
      font-size: 7.4pt;
    }

    .section-escola_disciplinas .reference-distribution-dot {
      width: 3.1mm;
      height: 3.1mm;
    }

    .section-escola_disciplinas .reference-area-legend {
      justify-content: flex-start;
      gap: 3.2mm;
      padding-right: 0;
      padding-left: 4.2mm;
      color: #7C858D;
      font-size: 7.5pt;
    }

    .section-habilidades_disciplina .context-strip {
      gap: 0;
      border-top: 1px solid #D9DEDB;
      border-bottom: 1px solid #D9DEDB;
      background: rgba(248, 249, 246, 0.96);
    }

    .section-habilidades_disciplina .context-item {
      min-height: 13.5mm;
      padding: 2.6mm 2.8mm;
      border: none;
      border-radius: 0;
      background: transparent;
      gap: 0.6mm;
    }

    .section-habilidades_disciplina .context-item + .context-item {
      border-left: 1px solid #E1E5E2;
    }

    .section-habilidades_disciplina .context-item-label {
      font-size: 7pt;
      letter-spacing: 0.12em;
    }

    .section-habilidades_disciplina .context-item-value {
      font-size: 10.1pt;
      line-height: 1.16;
    }

    .section-habilidades_disciplina .muted {
      margin-top: -0.8mm;
      color: #8C959D;
      font-size: 7.5pt;
      letter-spacing: 0.02em;
    }

    .section-habilidades_disciplina .panel {
      border-radius: 3mm;
      padding: 3.5mm 3.7mm;
      border-color: #D8DEDC;
      background: #FFFFFF;
    }

    .section-habilidades_disciplina .panel-title {
      margin-bottom: 2.2mm;
      font-size: 10.6pt;
      line-height: 1.2;
    }

    .section-habilidades_disciplina .skills-table {
      font-size: 8.4pt;
      background: #FFFFFF;
    }

    .section-habilidades_disciplina .skills-table th,
    .section-habilidades_disciplina .skills-table td {
      padding: 2.4mm 2mm;
      border-color: #DCE2DF;
    }

    .section-habilidades_disciplina .skills-table th {
      background: #F1F4F2;
      font-size: 7.1pt;
      letter-spacing: 0.1em;
    }

    .section-habilidades_disciplina .skills-table td {
      line-height: 1.42;
    }

    .section-habilidades_disciplina .skill-code {
      width: 18mm;
      color: ${brandStrong};
      font-size: 8pt;
      letter-spacing: 0.03em;
    }

    .section-habilidades_disciplina .skill-score-pill {
      min-width: 16mm;
      padding: 0.7mm 1.8mm;
      border-radius: 2mm;
      font-size: 7.3pt;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
    }

    .layout-style-dense-table .dense-table-panel,
    .layout-style-dense-table .chart-panel-dense-table {
      border-radius: 3.4mm;
      border: 1px solid #D7DEDB;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(247, 248, 245, 0.98) 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
    }

    .layout-style-dense-table .dense-table-panel .panel-title,
    .layout-style-dense-table .chart-panel-dense-table .chart-title {
      margin-bottom: 2mm;
      color: #5F6B74;
      font-size: 8pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .layout-style-dense-table .dense-table-table {
      background: #FFFFFF;
    }

    .layout-style-dense-table .dense-table-table th,
    .layout-style-dense-table .dense-table-table td {
      border-color: #D7DEDB;
    }

    .layout-style-dense-table .dense-table-table th {
      background: #EEF2F0;
      color: ${brandStrong};
      letter-spacing: 0.11em;
    }

    .layout-style-dense-table.section-ranking .hero-panel,
    .layout-style-dense-table.section-habilidades_disciplina .hero-panel {
      border-radius: 3.6mm;
      border: 1px solid #D7DEDB;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(243, 245, 242, 0.96) 100%);
      padding: 4mm 4.2mm;
      gap: 2.6mm;
    }

    .layout-style-dense-table.section-ranking .hero-panel-copy,
    .layout-style-dense-table.section-habilidades_disciplina .hero-panel-copy {
      max-width: 108mm;
      font-size: 9.1pt;
      line-height: 1.48;
    }

    .layout-style-dense-table.section-ranking .hero-kpi-chip,
    .layout-style-dense-table.section-habilidades_disciplina .hero-kpi-chip {
      padding: 1.2mm 2.6mm;
      border-color: #D7DEDB;
      background: rgba(255, 255, 255, 0.94);
      font-size: 7.5pt;
      letter-spacing: 0.04em;
    }

    .layout-style-dense-table.section-ranking .hero-kpi-chip strong,
    .layout-style-dense-table.section-habilidades_disciplina .hero-kpi-chip strong {
      font-size: 8.9pt;
    }

    .layout-style-dense-table.section-ranking .dense-table-chart-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 2.8mm;
    }

    .layout-style-dense-table.section-ranking .ranking-chart-row-dense {
      grid-template-columns: minmax(26mm, 0.92fr) minmax(0, 2.45fr) 11mm;
      gap: 2.2mm;
      margin-bottom: 1.8mm;
    }

    .layout-style-dense-table.section-ranking .ranking-label {
      color: #30414D;
      font-size: 7.8pt;
      line-height: 1.22;
    }

    .layout-style-dense-table.section-ranking .chart-track {
      min-height: 5.4mm;
      background: #EDF1EF;
      box-shadow: inset 0 0 0 1px rgba(13, 71, 161, 0.04);
    }

    .layout-style-dense-table.section-ranking .chart-bar {
      min-height: 5.4mm;
    }

    .layout-style-dense-table.section-ranking .chart-value {
      color: ${brandStrong};
      font-weight: 700;
      font-size: 8.2pt;
    }

    .layout-style-dense-table.section-ranking .dense-table-panel-ranking .data-table td:first-child,
    .layout-style-dense-table.section-ranking .dense-table-panel-ranking .data-table th:first-child {
      width: 17mm;
      text-align: center;
    }

    .layout-style-dense-table.section-ranking .dense-table-panel-ranking .data-table td:last-child,
    .layout-style-dense-table.section-ranking .dense-table-panel-ranking .data-table th:last-child {
      width: 19mm;
      text-align: right;
    }

    .layout-style-dense-table.section-habilidades_disciplina .dense-table-context-strip {
      border: 1px solid #D7DEDB;
      border-radius: 3.2mm;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(248, 249, 246, 0.98) 0%, rgba(242, 244, 241, 0.96) 100%);
    }

    .layout-style-dense-table.section-habilidades_disciplina .dense-table-context-strip .context-item {
      min-height: 12.6mm;
      padding: 2.4mm 2.6mm;
    }

    .layout-style-dense-table.section-habilidades_disciplina .dense-table-context-strip .context-item-value {
      font-size: 9.8pt;
    }

    .layout-style-dense-table.section-habilidades_disciplina .dense-table-pagination {
      padding-left: 0.6mm;
      color: #73808A;
      font-size: 7.6pt;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .layout-style-dense-table.section-habilidades_disciplina .dense-table-panel-skills .skills-table td {
      line-height: 1.36;
    }

    .layout-style-dense-table.section-habilidades_disciplina .dense-table-panel-skills .skill-code {
      width: 19mm;
      font-size: 7.8pt;
      letter-spacing: 0.06em;
    }

    .layout-style-dense-table.section-habilidades_disciplina .dense-table-panel-skills .skill-score-pill {
      min-width: 17mm;
      padding: 0.85mm 2.1mm;
      border-radius: 999px;
      font-size: 7.1pt;
      font-weight: 700;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2), 0 1px 1px rgba(13, 71, 161, 0.06);
    }

    /* Canoas reference fidelity overrides */

    .sr-only,
    .fidelity-shadow {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    .page {
      padding: 18mm 16mm 15mm;
      background: linear-gradient(180deg, #FBFBF8 0%, #F4F3EE 100%);
      gap: 4.8mm;
    }

    .page::before {
      inset: auto 0 0 0;
      height: 5.4mm;
      border: none;
      border-radius: 0;
      background: ${c.secondary};
    }

    .page::after {
      display: none;
    }

    .page-header {
      min-height: 14mm;
      align-items: start;
    }

    .page-header::after {
      content: 'Relatório Diagnóstico Educacional';
      position: absolute;
      top: 18mm;
      right: 16mm;
      color: #C6CBD0;
      font-size: 8.4pt;
      font-weight: 600;
    }

    .page-heading {
      gap: 0.3mm;
      padding-right: 34mm;
    }

    .page-eyebrow {
      display: none;
    }

    .page-title {
      color: #55626C;
      font-size: 16.6pt;
      font-weight: 700;
      max-width: 122mm;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      color: ${c.secondary};
      font-size: 13.2pt;
      font-weight: 700;
      line-height: 1.18;
      max-width: 122mm;
    }

    .page-number {
      position: absolute;
      left: 50%;
      bottom: 9.2mm;
      transform: translateX(-50%);
      min-width: 13mm;
      min-height: 11mm;
      padding: 1.4mm 4.5mm 1.6mm;
      border-radius: 2.8mm;
      border: 1px solid #B2B7BC;
      background: #FFFFFF;
      color: #80878F;
      box-shadow: none;
    }

    .page-number::after {
      left: 50%;
      bottom: -2.2mm;
      width: 5mm;
      height: 5mm;
      background: #FFFFFF;
      border-right: 1px solid #B2B7BC;
      border-bottom: 1px solid #B2B7BC;
      border-radius: 0 0 1mm 0;
      transform: translateX(-50%) rotate(45deg);
    }

    .page-number-label {
      display: none;
    }

    .page-number-value {
      font-size: 11pt;
      color: #7D848B;
    }

    .page-footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0 16mm 2.6mm;
      border: none;
      border-radius: 0;
      background: transparent;
      color: #9EA7AF;
      font-size: 8pt;
      letter-spacing: 0.01em;
    }

    .page-footer > div:first-child {
      visibility: hidden;
    }

    .page-footer-center {
      color: #8D959D;
      font-weight: 700;
    }

    .page-footer-right {
      color: #A8AFB5;
    }

    .cover-page .page-number,
    .chapter-page .page-number {
      display: none;
    }

    .panel,
    .chart-panel,
    .hero-panel,
    .indicator-card {
      box-shadow: none;
    }

    .panel,
    .chart-panel {
      border-radius: 4mm;
      border-color: #D6DDDC;
      background: #FFFFFF;
    }

    .hero-panel {
      border: none;
      border-radius: 0;
      padding: 0;
      background: transparent;
    }

    .hero-panel-title,
    .panel-title {
      color: ${brandStrong};
    }

    .section-apresentacao .page-header,
    .section-escola .page-header {
      display: none;
    }

    .section-apresentacao::before {
      display: none;
    }

    .section-apresentacao .page-footer {
      display: none;
    }

    .institutional-credits {
      min-height: 248mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      padding: 18mm 12mm 12mm;
      color: #6D7881;
    }

    .institutional-credits-header {
      display: flex;
      flex-direction: column;
      gap: 2mm;
    }

    .institutional-credits-kicker,
    .institutional-credits-sub {
      color: ${c.secondary};
      font-size: 13pt;
      font-weight: 700;
      line-height: 1.3;
    }

    .institutional-partnership {
      display: flex;
      flex-direction: column;
      gap: 5mm;
      align-items: center;
    }

    .institutional-partnership-label {
      color: #8B939B;
      font-size: 11pt;
    }

    .institutional-partnership-logos {
      display: flex;
      align-items: center;
      gap: 6mm;
    }

    .institutional-logo-divider {
      width: 1px;
      height: 18mm;
      background: #D7DDDD;
    }

    .institutional-credits-copy {
      max-width: 88mm;
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
      font-size: 11pt;
      line-height: 1.7;
    }

    .institutional-credits-copy p {
      margin: 0;
    }

    .institutional-material-note {
      margin-top: 4mm;
      color: #88929A;
      font-size: 10pt;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .cover-hero {
      min-height: 297mm;
      display: grid;
      grid-template-columns: 54mm minmax(0, 1fr);
      grid-template-rows: 1fr;
      background: linear-gradient(156deg, #0E4866 0%, #103D59 28%, #0A2638 100%);
      overflow: hidden;
    }

    .cover-gear-field {
      position: relative;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.1));
      overflow: hidden;
    }

    .cover-gear-field::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(6, 27, 40, 0.18));
    }

    .cover-gear {
      position: absolute;
      opacity: 0.28;
      filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.16));
    }

    .cover-gear-large {
      width: 88mm;
      height: 88mm;
      top: 20mm;
      left: 18mm;
    }

    .cover-gear-small {
      width: 56mm;
      height: 56mm;
      bottom: 46mm;
      left: 22mm;
    }

    .cover-gear-mini {
      width: 22mm;
      height: 22mm;
      top: 112mm;
      left: 14mm;
    }

    .cover-band[data-layout="cover-slab"] {
      padding: 30mm 18mm 18mm;
      background: linear-gradient(180deg, rgba(4, 29, 43, 0.04), rgba(4, 29, 43, 0));
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3.8mm;
      color: #FFFFFF;
    }

    .cover-band[data-layout="cover-slab"]::after {
      display: none;
    }

    .cover-kicker {
      color: rgba(255, 255, 255, 0.82);
      font-size: 12.5pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      -webkit-text-stroke: 0;
    }

    .cover-band-title {
      margin: 0;
      max-width: 92mm;
      color: #FFFFFF;
      font-size: 39pt;
      line-height: 0.98;
      letter-spacing: -0.03em;
      text-shadow: none;
    }

    .cover-powered {
      margin: 0;
      color: rgba(255, 255, 255, 0.68);
      font-size: 10.5pt;
      line-height: 1.45;
    }

    .cover-edition-code {
      margin-top: auto;
      color: ${accentColor};
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.12em;
    }

    .cover-brand-footer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 8mm;
      width: 100%;
      padding-top: 5mm;
      border-top: 1px solid rgba(255, 255, 255, 0.18);
    }

    .cover-support-media {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 3mm;
      max-width: 40mm;
      padding: 2.2mm 2.6mm;
      border-radius: 4mm;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.24);
      box-shadow: 0 1.5mm 4mm rgba(3, 26, 40, 0.16);
    }

    .cover-support-media .cover-image {
      max-width: 100%;
      max-height: 18mm;
      display: block;
    }

    .brand-lockup,
    .educacross-lockup {
      display: inline-flex;
      align-items: center;
      gap: 3mm;
    }

    .brand-lockup-shield {
      width: 10mm;
      height: 12mm;
      border-radius: 2mm 2mm 4mm 4mm;
      background: linear-gradient(180deg, #39C4BE 0%, #0A5673 100%);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
    }

    .brand-lockup-copy,
    .educacross-copy {
      display: flex;
      flex-direction: column;
      line-height: 1;
      color: #FFFFFF;
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
    }

    .brand-lockup-copy strong,
    .educacross-copy strong {
      font-size: 17pt;
    }

    .educacross-mark {
      width: 8mm;
      height: 8mm;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: #19BBB4;
      color: #063B57;
      font-size: 13pt;
      line-height: 1;
    }

    .chapter-hero {
      min-height: 297mm;
      background: linear-gradient(180deg, #FCFCF9 0%, #F1F0E8 100%);
    }

    .chapter-sequence {
      color: rgba(19, 61, 89, 0.09);
      font-family: ${displayFontStack};
      font-size: 46pt;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .chapter-marker {
      color: ${accentColor};
      letter-spacing: 0.18em;
    }

    .chapter-title {
      max-width: 104mm;
      color: ${brandStrong};
      line-height: 0.98;
    }

    .chapter-summary {
      max-width: 92mm;
      color: ${c.textSecondary};
      line-height: 1.58;
    }

    .chapter-divider {
      width: 42mm;
      height: 1.2mm;
      background: ${accentColor};
    }

    /* Chapter hero — editorial baseline (ref p7: dark solid bg + triple title overlay) */
    .chapter-hero {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .chapter-hero-bg-accent {
      position: absolute;
      inset: 0;
    }

    .chapter-hero-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
    }

    .chapter-hero-img-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(19,61,89,0.65) 0%, rgba(19,61,89,0.2) 100%);
    }

    .chapter-hero-overlay-asset {
      position: absolute;
      right: -2mm;
      bottom: 0;
      width: 44%;
      max-height: 86%;
      object-fit: contain;
      object-position: bottom right;
      z-index: 1;
      opacity: 0.92;
      pointer-events: none;
    }

    .chapter-content-inner {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 3.5mm;
      padding: 28mm 20mm 22mm;
      min-height: 297mm;
    }

    .chapter-copy-block {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 3.2mm;
      max-width: 116mm;
    }

    .chapter-title-triple {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: 3mm;
    }

    .chapter-title-ghost {
      font-family: ${displayFontStack};
      font-size: 32pt;
      font-weight: 700;
      line-height: 1.0;
      color: transparent;
      -webkit-text-stroke: 1.2px rgba(255,255,255,0.5);
    }

    .chapter-title-bold {
      font-family: ${displayFontStack};
      font-size: 32pt;
      font-weight: 800;
      line-height: 1.0;
      color: #FFFFFF;
    }

    .chapter-kicker-block {
      display: flex;
      flex-direction: column;
      gap: 0.8mm;
      margin-bottom: 1.6mm;
    }

    .chapter-kicker-line,
    .chapter-kicker-line-secondary {
      font-size: 8.4pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.82);
    }

    .chapter-kicker-line-secondary {
      font-weight: 400;
      letter-spacing: 0.18em;
      color: rgba(255, 255, 255, 0.68);
    }

    .chapter-hero-resultados .chapter-hero-img {
      object-position: 66% center;
      transform: scale(1.06);
    }

    .chapter-hero-resultados .chapter-hero-img-overlay {
      background: linear-gradient(92deg, rgba(10, 28, 40, 0.94) 0%, rgba(10, 28, 40, 0.72) 40%, rgba(10, 28, 40, 0.22) 100%);
    }

    .chapter-hero-resultados .chapter-content-inner {
      justify-content: center;
      gap: 2.4mm;
      padding: 20mm 20mm 18mm;
    }

    .chapter-hero-resultados .chapter-copy-block {
      max-width: 122mm;
      gap: 2.8mm;
      padding: 10mm 16mm 10mm 0;
      margin-top: 18mm;
    }

    .chapter-hero-resultados .chapter-copy-block::before {
      content: '';
      position: absolute;
      inset: -6mm -10mm -6mm -5mm;
      background: linear-gradient(90deg, rgba(10, 28, 40, 0.80) 0%, rgba(10, 28, 40, 0.48) 72%, rgba(10, 28, 40, 0) 100%);
      border-left: 1.2mm solid ${accentColor};
      border-radius: 0 8mm 8mm 0;
      z-index: -1;
    }

    .chapter-hero-resultados .chapter-summary {
      display: none;
    }

    .chapter-hero-resultados .chapter-sequence {
      position: absolute;
      top: 19mm;
      left: 20mm;
      display: block;
      font-family: ${displayFontStack};
      font-size: 86pt;
      line-height: 0.84;
      font-weight: 800;
      color: rgba(19, 180, 174, 0.92);
      -webkit-text-stroke: 1.2px rgba(255, 211, 106, 0.94);
      text-shadow: 0 1.6mm 3.2mm rgba(10, 28, 40, 0.2);
      z-index: 2;
      opacity: 0.96;
    }

    .chapter-hero-resultados .chapter-marker {
      font-size: 8pt;
      letter-spacing: 0.16em;
      color: rgba(255, 255, 255, 0.82);
    }

    .chapter-hero-resultados .chapter-title-ghost,
    .chapter-hero-resultados .chapter-title-bold {
      font-size: 35pt;
    }

    .chapter-hero-resultados .chapter-title-ghost {
      -webkit-text-stroke: 1px rgba(255,255,255,0.30);
    }

    .chapter-hero-resultados .chapter-hero-overlay-asset {
      right: -4mm;
      bottom: 0;
      width: 47%;
      max-height: 90%;
      opacity: 0.94;
    }

    .section-escola .page-content {
      padding-top: 0;
    }

    .analytic-split[data-layout="school-summary-shell"] {
      grid-template-columns: minmax(69mm, 0.9fr) minmax(0, 1.1fr);
      gap: 0;
      min-height: 100%;
      height: 100%;
      background: #FFFFFF;
      position: relative;
      overflow: hidden;
    }

    .analytic-split[data-layout="school-summary-shell"]::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 4.2mm;
      background: ${c.secondary};
    }

    .analytic-split[data-layout="school-summary-shell"] > * {
      gap: 0;
    }

    .school-summary-aside {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 12mm 9mm 18mm 10mm;
      background: linear-gradient(180deg, #D8D5CC 0%, #D5D1C8 100%);
    }

    .school-brand-block {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 2.8mm;
      margin-bottom: 4mm;
    }

    .school-brand-eyebrow {
      color: #5A6670;
      font-size: 10.2pt;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
    }

    .school-brand-partnership {
      width: 100%;
      display: none;
    }

    .school-hero-figure {
      position: relative;
      width: 100%;
      min-height: 39mm;
      margin-bottom: 1.8mm;
    }

    .school-hero-figure::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 2.4mm;
      height: 0.45mm;
      background: #0F4A6B;
      opacity: 0.82;
    }

    .school-hero-figure::before {
      content: '';
      position: absolute;
      left: 0;
      bottom: 1.3mm;
      width: 1.4mm;
      height: 1.4mm;
      border-radius: 50%;
      background: #0F4A6B;
      box-shadow: calc(100% - 1.4mm) 0 0 #0F4A6B;
    }

    .school-owl-wrap {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: center;
      width: 100%;
    }

    .school-owl-wrap .school-owl-image {
      width: 43mm;
      max-height: 36mm;
      object-fit: contain;
      object-position: center bottom;
      filter: drop-shadow(0 1.6mm 2.4mm rgba(14, 52, 71, 0.14));
      display: block;
    }

    .school-summary-main {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 8.5mm;
      padding: 14mm 10mm 18mm 10mm;
      background: #F4F4F4;
    }

    .school-ranking-ribbon {
      margin-bottom: 4mm;
      padding: 1.6mm 4mm;
      border-radius: 999px;
      border: 1px solid #A6C9C4;
      background: rgba(255, 255, 255, 0.9);
      color: ${brandStrong};
      font-size: 8.2pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .school-name-display {
      width: 100%;
      margin: 0 0 5.5mm;
      padding-top: 0;
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: 26pt;
      line-height: 0.94;
      letter-spacing: -0.03em;
    }

    .school-kpi-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2.8mm;
      margin-bottom: 1.2mm;
    }

    .school-kpi-card {
      position: relative;
      padding: 4.4mm 3.3mm 3.4mm;
      border: 1px solid rgba(19, 61, 89, 0.08);
      border-radius: 2.6mm;
      background: rgba(255, 255, 255, 0.92);
      text-align: center;
      box-shadow: 0 1.4mm 2.6mm rgba(15, 47, 66, 0.06);
    }

    .school-kpi-card::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -1.6mm;
      width: 4.4mm;
      height: 4.4mm;
      background: rgba(255, 255, 255, 0.96);
      transform: translateX(-50%) rotate(45deg);
      border-right: 1px solid rgba(19, 61, 89, 0.08);
      border-bottom: 1px solid rgba(19, 61, 89, 0.08);
      border-radius: 0 0 0.8mm 0;
    }

    .school-kpi-value {
      color: ${c.secondary};
      font-family: ${displayFontStack};
      font-size: 22pt;
      font-weight: 700;
      line-height: 1;
    }

    .school-kpi-label {
      margin-top: 1.2mm;
      color: #5E6770;
      font-size: 8.4pt;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .school-kpi-note {
      color: #8E969D;
      font-size: 7.4pt;
      line-height: 1.25;
    }

    .school-operational-table {
      margin-top: 3.2mm;
      font-size: 8.6pt;
      border: 1px solid #D8DEDC;
      background: rgba(255, 255, 255, 0.48);
    }

    .school-operational-table th {
      background: ${brandStrong};
      color: #FFFFFF;
      padding-top: 2.2mm;
      padding-bottom: 2.2mm;
    }

    .school-operational-table td:last-child,
    .school-operational-table th:last-child {
      text-align: right;
      width: 20mm;
    }

    .school-table-section-row td {
      background: #EFF3F1;
      color: ${brandStrong};
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .school-participation-feature {
      margin-top: auto;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1mm;
      padding-top: 5mm;
    }

    .school-participation-number {
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: 28pt;
      font-weight: 700;
      line-height: 1;
      -webkit-text-stroke: 0.28mm rgba(255, 255, 255, 0.9);
      text-shadow: 0 0.6mm 0 rgba(255, 255, 255, 0.85);
    }

    .school-participation-label {
      color: ${brandStrong};
      font-size: 9.4pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .school-participation-stars {
      position: absolute;
      right: 16mm;
      bottom: 1mm;
      display: flex;
      gap: 1mm;
      color: #F0A41B;
      font-size: 17pt;
      line-height: 1;
      text-shadow: 0 0.6mm 0 #B85A18;
    }

    .school-summary-copy {
      margin: 0;
      max-width: 74mm;
      color: #707A84;
      font-size: 10.8pt;
      line-height: 1.95;
    }

    .school-stat-bubbles {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10mm;
      margin-top: 6mm;
      padding-left: 4mm;
    }

    .school-stat-bubble {
      position: relative;
      width: 44mm;
      min-height: 33mm;
      padding: 5mm 4.4mm 4.2mm 6.8mm;
      border: 0.55mm solid rgba(0, 163, 158, 0.95);
      border-radius: 2.8mm;
      background: #F9FAFA;
    }

    .school-stat-bubble::after {
      content: '';
      position: absolute;
      bottom: -1.75mm;
      left: 16mm;
      width: 5.4mm;
      height: 5.4mm;
      background: #F9FAFA;
      border-right: 0.55mm solid rgba(0, 163, 158, 0.95);
      border-bottom: 0.55mm solid rgba(0, 163, 158, 0.95);
      border-radius: 0 0 1mm 0;
      transform: rotate(45deg);
    }

    .school-stat-bubble::before {
      content: '';
      position: absolute;
      top: 50%;
      left: -12mm;
      width: 12mm;
      height: 0.55mm;
      background: rgba(0, 163, 158, 0.95);
    }

    .school-stat-bubble:nth-child(2) {
      margin-left: 21mm;
    }

    .school-stat-bubble:nth-child(2)::before {
      top: -10mm;
      left: -12mm;
      width: 12mm;
      height: 10mm;
      border-left: 0.55mm solid rgba(0, 163, 158, 0.95);
      border-top: 0.55mm solid rgba(0, 163, 158, 0.95);
      background: transparent;
    }

    .school-stat-icon,
    .reference-area-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
    }

    .school-stat-icon {
      position: absolute;
      left: -3.9mm;
      top: 13mm;
      width: 8.3mm;
      height: 8.3mm;
      border-radius: 1.2mm;
      box-shadow: 0 1mm 2.2mm rgba(15, 47, 66, 0.18);
    }

    .school-stat-icon svg,
    .reference-area-icon svg {
      width: 4.6mm;
      height: 4.6mm;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .discipline-matematica {
      background: ${accentColor};
    }

    .discipline-linguagens {
      background: ${c.brandPurple || c.accent};
    }

    .school-stat-value {
      font-family: ${displayFontStack};
      font-size: 26pt;
      font-weight: 700;
      line-height: 1;
    }

    .school-stat-copy {
      margin: 1.8mm 0 0;
      color: ${brandStrong};
      font-size: 8.8pt;
      line-height: 1.5;
    }

    .reference-school-area {
      display: flex;
      flex-direction: column;
      gap: 9mm;
      padding-top: 4mm;
    }

    .reference-school-area-grid {
      position: relative;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8mm;
    }

    .reference-school-area-grid::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 1px;
      background: #DDD8CF;
    }

    .reference-area-card {
      position: relative;
      padding: 4mm 6mm 0;
      display: flex;
      flex-direction: column;
      gap: 7mm;
    }

    .reference-area-card-head {
      display: flex;
      align-items: center;
      gap: 3mm;
    }

    .reference-area-icon {
      width: 10mm;
      height: 10mm;
      border-radius: 2mm;
      flex-shrink: 0;
    }

    .reference-area-chip {
      padding: 1.6mm 4.2mm;
      border-radius: 999px;
      background: ${c.secondary};
      color: #FFFFFF;
      font-size: 8.8pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .reference-distribution-block {
      display: grid;
      grid-template-columns: 18mm minmax(0, 1fr);
      gap: 3mm;
      align-items: center;
    }

    .reference-distribution-label {
      color: ${brandStrong};
      font-size: 12pt;
      line-height: 1.1;
    }

    .reference-distribution-body {
      display: flex;
      flex-direction: column;
      gap: 1.6mm;
    }

    .reference-distribution-axis {
      display: grid;
      grid-template-columns: repeat(11, minmax(0, 1fr));
      padding: 0 0.8mm;
      color: #98A2A9;
      font-size: 6.6pt;
      line-height: 1;
    }

    .reference-distribution-axis span {
      text-align: center;
    }

    .reference-distribution-track {
      position: relative;
      display: flex;
      min-height: 10mm;
      overflow: hidden;
      border-radius: 1.8mm;
      border-left: 2px solid ${brandStrong};
      background: #E8ECEB;
    }

    .reference-distribution-track::before {
      content: '';
      position: absolute;
      left: -3.4mm;
      top: 50%;
      width: 3.4mm;
      height: 1.1mm;
      background: ${brandStrong};
      transform: translateY(-50%);
    }

    .reference-distribution-segment {
      min-width: 0;
      border-right: 1px solid rgba(255, 255, 255, 0.34);
    }

    .reference-distribution-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1mm;
    }

    .reference-distribution-stat {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1mm;
      color: #7B848B;
      font-size: 8pt;
      font-weight: 700;
    }

    .reference-distribution-dot {
      width: 4mm;
      height: 4mm;
      border-radius: 999px;
      flex-shrink: 0;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.92), 0 0 0 2px rgba(150, 158, 166, 0.25);
    }

    .reference-area-legend {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 4mm;
      padding-right: 8mm;
      color: #8A9299;
      font-size: 8pt;
      font-weight: 700;
    }

    .reference-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 1.2mm;
    }

    /* ============================================================
       EDITORIAL SPLIT LAYOUT
       Clona o visual do PDF de referência (pág 14 — Dados Gerais)
       Layout: 58% esquerda (bloco visual) | 42% direita (conteúdo)
    ============================================================ */

    .section-participacao_rede.page,
    .section-contexto_avaliacao.page,
    .section-metodologia.page {
      padding: 0;
      gap: 0;
      background: #FFFFFF;
      overflow: hidden;
    }

    .section-participacao_rede::before,
    .section-participacao_rede_tabela::before,
    .section-participacao_rede::after,
    .section-participacao_rede_tabela::after,
    .section-contexto_avaliacao::before,
    .section-contexto_avaliacao::after,
    .section-metodologia::before,
    .section-metodologia::after {
      display: none;
    }

    .section-participacao_rede .page-header,
    .section-participacao_rede_tabela .page-header,
    .section-contexto_avaliacao .page-header,
    .section-metodologia .page-header,
    .section-participacao_rede .page-footer,
    .section-participacao_rede_tabela .page-footer,
    .section-contexto_avaliacao .page-footer,
    .section-metodologia .page-footer,
    .section-participacao_rede .page-number,
    .section-participacao_rede_tabela .page-number,
    .section-contexto_avaliacao .page-number,
    .section-metodologia .page-number {
      display: none;
    }

    .section-participacao_rede .page-content,
    .section-participacao_rede_tabela .page-content,
    .section-contexto_avaliacao .page-content,
    .section-metodologia .page-content {
      flex: 1;
      display: flex;
      min-height: 297mm;
    }

    .editorial-split {
      display: grid;
      grid-template-columns: 55% 45%;
      min-height: 297mm;
      width: 100%;
    }

    .editorial-split-visual {
      position: relative;
      background: #FFFFFF;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .editorial-split-visual-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
    }

    .editorial-split-visual-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(19, 61, 89, 0.60) 0%, rgba(19, 61, 89, 0.20) 100%);
    }

    .editorial-split-visual-placeholder {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, #EAF0F5 0%, #D8E4EC 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .editorial-split-visual-accent {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1.4mm;
      background: ${accentColor};
    }

    .editorial-split-content {
      display: flex;
      flex-direction: column;
      padding: 12mm 12mm 10mm 10mm;
      background: #FFFFFF;
      position: relative;
    }

    .editorial-split-header {
      color: #B0B8C0;
      font-size: 7.5pt;
      font-weight: 400;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 8mm;
    }

    .editorial-split-chapter {
      margin-bottom: 6mm;
    }

    .editorial-split-chapter-title {
      margin: 0 0 0.8mm;
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: 22pt;
      font-weight: 800;
      line-height: 1.0;
      letter-spacing: -0.02em;
    }

    .editorial-split-chapter-subtitle {
      margin: 0;
      color: ${brandSecondary};
      font-family: ${displayFontStack};
      font-size: 16pt;
      font-weight: 600;
      line-height: 1.1;
    }

    .editorial-split-highlight-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 2.4mm;
      margin: 1.5mm 0 0;
    }

    .editorial-split-highlight {
      border-top: 0.8mm solid ${accentColor};
      padding-top: 2.2mm;
      display: flex;
      flex-direction: column;
      gap: 0.8mm;
    }

    .editorial-split-highlight-label {
      color: #7B8893;
      font-size: 6.9pt;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .editorial-split-highlight-value {
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: 14pt;
      font-weight: 800;
      line-height: 1;
    }

    .editorial-split-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 5mm;
      margin-top: 8mm;
    }

    .editorial-split-text {
      color: ${c.textPrimary};
      font-size: 9.5pt;
      line-height: 1.75;
      text-align: justify;
      text-indent: 5mm;
    }

    .editorial-split-text + .editorial-split-text {
      text-indent: 5mm;
    }

    .editorial-split-bullet {
      display: inline-block;
      width: 2mm;
      height: 2mm;
      background: ${accentColor};
      border-radius: 50%;
      margin-bottom: 0.4mm;
    }

    .editorial-split-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10mm;
      padding-top: 3mm;
      border-top: 0.3mm solid #E4E8EA;
    }

    .editorial-split-page-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 9mm;
      height: 9mm;
      background: ${badgeColor};
      color: ${badgeText};
      font-size: 9pt;
      font-weight: 700;
      border-radius: 50%;
      position: relative;
    }

    .editorial-split-footer-label {
      color: #B0B8C0;
      font-size: 7.5pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .section-participacao_rede .editorial-split {
      grid-template-columns: 60% 40%;
    }

    .section-participacao_rede .editorial-split-visual {
      background: #FFFFFF;
      align-items: stretch;
      justify-content: stretch;
    }

    .section-participacao_rede .editorial-split-visual::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, #FFFFFF 0%, #FBFBFB 100%);
    }

    .section-participacao_rede .editorial-split-visual-img,
    .section-participacao_rede .editorial-split-visual-overlay,
    .section-participacao_rede .editorial-split-visual-placeholder,
    .section-participacao_rede .editorial-split-visual-accent,
    .section-participacao_rede .editorial-split-highlight-row {
      display: none;
    }

    .section-participacao_rede .editorial-split-content {
      padding: 13mm 14mm 10mm 6mm;
      background: #FFFFFF;
    }

    .section-participacao_rede .editorial-split-content::before {
      display: none;
    }

    .section-participacao_rede .editorial-split-header {
      margin-bottom: 12mm;
      color: #C3C8CC;
      font-weight: 400;
      letter-spacing: 0.06em;
    }

    .section-participacao_rede .editorial-split-chapter-title {
      font-size: 22pt;
      line-height: 1;
    }

    .section-participacao_rede .editorial-split-chapter-subtitle {
      color: #5FAFAD;
      font-size: 15pt;
      font-weight: 500;
    }

    .section-participacao_rede .editorial-split-body {
      max-width: 69mm;
      gap: 5.4mm;
      margin-top: 31mm;
      margin-left: auto;
    }

    .section-participacao_rede .editorial-split-text:first-child {
      color: ${c.textMuted};
      font-weight: 400;
      text-indent: 0;
    }

    .section-participacao_rede .editorial-split-text {
      color: ${c.textMuted};
      font-size: 9.7pt;
      line-height: 1.9;
      text-align: right;
      text-indent: 0;
    }

    .section-participacao_rede .editorial-split-footer {
      margin-top: 8mm;
      padding-top: 0;
      border-top: 0;
    }

    .participacao-editorial {
      display: grid;
      grid-template-columns: 57.5% 42.5%;
      width: 100%;
      min-height: 297mm;
      background: #FFFFFF;
    }

    .participacao-editorial-media {
      position: relative;
      overflow: hidden;
      background: #DCE5EA;
    }

    .participacao-editorial-image,
    .participacao-editorial-placeholder {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .participacao-editorial-image {
      object-fit: cover;
      object-position: 28% center;
    }

    .participacao-editorial-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, #E9EFF3 0%, #D5E0E7 100%);
    }

    .participacao-editorial-placeholder svg {
      opacity: 0.22;
    }

    .participacao-editorial-copy {
      display: flex;
      flex-direction: column;
      padding: 19mm 13mm 10mm 8mm;
      background: #FFFFFF;
      position: relative;
    }

    .participacao-editorial-kicker {
      display: flex;
      flex-direction: column;
      gap: 0.6mm;
      margin-bottom: 21mm;
    }

    .participacao-editorial-kicker-primary {
      color: #6E757B;
      font-family: ${displayFontStack};
      font-size: 12pt;
      font-weight: 800;
      letter-spacing: 0.01em;
    }

    .participacao-editorial-kicker-secondary {
      color: #6AB8AE;
      font-family: ${displayFontStack};
      font-size: 12pt;
      font-weight: 400;
      letter-spacing: 0.01em;
    }

    .participacao-editorial-rule {
      width: 100%;
      max-width: 69mm;
      height: 0.45mm;
      background: #DDE5E4;
      margin-bottom: 33mm;
    }

    .participacao-editorial-body {
      max-width: 70mm;
      display: flex;
      flex-direction: column;
      gap: 6mm;
      color: #6E757B;
      font-size: 11pt;
      line-height: 1.82;
    }

    .participacao-editorial-paragraph {
      margin: 0;
      text-align: left;
      text-indent: 7mm;
    }

    .participacao-editorial-dot {
      width: 5.4mm;
      height: 5.4mm;
      border-radius: 50%;
      background: #78B948;
      margin-top: 1.5mm;
    }

    .participacao-editorial-footer {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4mm;
      max-width: 70mm;
      padding-top: 5mm;
    }

    .participacao-editorial-footer-label {
      color: #B5BCC2;
      font-size: 8pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    /* Tabela editorial estilo referência pág 15-18 */

    .editorial-table-section {
      width: 100%;
      page-break-inside: avoid;
      border: 0.25mm solid #D7E0E5;
      border-radius: 4mm;
      background: #FFFFFF;
      overflow: hidden;
      box-shadow: 0 3mm 10mm rgba(19, 61, 89, 0.08);
    }

    .editorial-table-page {
      min-height: 297mm;
      width: 100%;
      padding: 14mm 12mm 10mm;
      display: flex;
      flex-direction: column;
      gap: 4mm;
      background: #FFFFFF;
    }

    .editorial-table-page-header {
      display: block;
    }

    .editorial-table-page-kicker {
      font-size: 8pt;
      letter-spacing: 0.06em;
      color: #C3C8CC;
      font-weight: 400;
      margin-bottom: 8mm;
    }

    .editorial-table-page-title {
      display: none;
    }

    .editorial-table-page-subtitle {
      display: none;
    }

    .editorial-table-header-row {
      display: inline-flex;
      align-items: center;
      margin-bottom: 4.5mm;
      padding: 2.1mm 6mm 2.1mm 6mm;
      background: #14B3AE;
      border-radius: 999px;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 8.7pt;
      line-height: 1.2;
    }

    .editorial-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.6pt;
    }

    .editorial-table thead th {
      background: ${brandStrong};
      color: #FFFFFF;
      font-weight: 700;
      font-size: 8pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 2.2mm 2.8mm;
      text-align: left;
      border-right: 0.25mm solid rgba(255,255,255,0.26);
    }

    .editorial-table th.editorial-table-th-numeric,
    .editorial-table td.editorial-table-cell-numeric {
      text-align: right;
    }

    .editorial-table thead th:last-child {
      text-align: right;
    }

    .editorial-table tbody tr:nth-child(even) td {
      background: #F0EFEB;
    }

    .editorial-table tbody tr:nth-child(odd) td {
      background: #F8F8F7;
    }

    .editorial-table td {
      padding: 1.9mm 2.8mm;
      border-bottom: 0.2mm solid #E1E1DC;
      color: #7C807F;
    }

    .editorial-table td:last-child {
      text-align: right;
      font-weight: 500;
      color: #7C807F;
    }

    .editorial-table-school-name {
      font-weight: 400;
      color: #7C807F;
    }

    .editorial-table-page-footer {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4mm;
      color: ${c.textMuted};
      font-size: 8.5pt;
      border-top: 0.25mm solid #D7E0E5;
      padding-top: 3mm;
    }

    /* Chapter page editorial updates */

    .chapter-page.section-capitulo {
      padding: 0;
      background: transparent;
    }

    .chapter-hero {
      background: ${brandStrong};
      min-height: 297mm;
    }

    .chapter-hero .chapter-sequence {
      color: rgba(255, 255, 255, 0.10);
    }

    .chapter-hero .chapter-marker {
      color: rgba(255, 255, 255, 0.70);
    }

    .chapter-hero .chapter-title,
    .chapter-hero .chapter-summary {
      color: #FFFFFF;
    }

    .chapter-hero .chapter-divider {
      background: ${accentColor};
    }
  `;
}

function renderPage(page, charts, theme, metadata, options) {
  const chrome = buildPageChrome(page, metadata, options);
  const chromeSpec = resolvePageChromeSpec(page);
  const layoutProfile = resolveLayoutProfile(page, chromeSpec);

  if (layoutProfile.renderMode === 'editorial-split') {
    const layout = page.layout || {};
    const layoutAttributes = buildLayoutAttributes(layout);
    const pageClasses = ['page', ...buildLayoutClassNames(layout)];
    return `
      <section class="${pageClasses.join(' ')} section-${escapeHtml(page.section)}"${layoutAttributes}>
        <div class="page-content">
          ${renderEditorialNarrativePage(page, chrome, options.assetResolver)}
        </div>
      </section>
    `;
  }

  if (layoutProfile.renderMode === 'editorial-table') {
    const layout = page.layout || {};
    const layoutAttributes = buildLayoutAttributes(layout);
    const pageClasses = ['page', ...buildLayoutClassNames(layout)];
    return `
      <section class="${pageClasses.join(' ')} section-${escapeHtml(page.section)}"${layoutAttributes}>
        <div class="page-content">
          ${renderEditorialTablePage(page, chrome)}
        </div>
      </section>
    `;
  }

  if (layoutProfile.renderMode === 'framed') {
    return renderFramedPage(page, charts, theme, metadata, options, chrome, chromeSpec);
  }

  return renderLegacyPage(page, charts, theme, metadata, options, chrome, layoutProfile);
}

function resolveLayoutProfile(page, chromeSpec) {
  const layout = page.layout || {};
  const templateId = String(layout.templateId || '');
  const shellRef = String(layout.shellRef || '');
  const styleRef = String(layout.styleRef || '');
  const section = String(page.section || '');

  let renderMode = 'legacy';

  if (templateId === 'editorial-body' || shellRef === 'editorial-split-shell') {
    renderMode = 'editorial-split';
  } else if (templateId === 'editorial-table' || shellRef === 'editorial-table-shell') {
    renderMode = 'editorial-table';
  } else if (chromeSpec.mode === 'framed' || styleRef === 'dense-table' || styleRef === 'school-summary' || styleRef === 'school-comparison') {
    renderMode = 'framed';
  } else if (section === 'participacao_rede' || section === 'contexto_avaliacao' || section === 'metodologia') {
    renderMode = 'editorial-split';
  } else if (section === 'participacao_rede_tabela') {
    renderMode = 'editorial-table';
  }

  let contentRendererKey = 'default';

  if (templateId === 'cover-page' || section === 'capa') {
    contentRendererKey = 'cover';
  } else if (templateId === 'chapter-opener' || section === 'capitulo') {
    contentRendererKey = 'chapter';
  } else if (styleRef === 'analytic-overview' || styleRef === 'analytic-discipline' || section === 'visao_geral' || section === 'resultados_disciplina') {
    contentRendererKey = 'analytical';
  } else if (styleRef === 'school-summary' || section === 'escola') {
    contentRendererKey = 'school-summary';
  } else if (styleRef === 'school-comparison' || section === 'escola_disciplinas') {
    contentRendererKey = 'school-comparison';
  } else if (templateId === 'skills-table' || section === 'habilidades_disciplina') {
    contentRendererKey = 'skills';
  } else if (section === 'resultados_ano') {
    contentRendererKey = 'year-results';
  } else if (section === 'ranking') {
    contentRendererKey = 'ranking';
  } else if (section === 'apresentacao') {
    contentRendererKey = 'presentation';
  } else if (section === 'sumario') {
    contentRendererKey = 'sumario';
  }

  return {
    renderMode,
    contentRendererKey,
    shellRef: layout.shellRef || '',
    styleRef: layout.styleRef || '',
    templateId: layout.templateId || '',
  };
}

function renderLegacyPage(page, charts, theme, metadata, options, chrome, layoutProfile) {
  const data = page.data || {};
  const layout = page.layout || {};
  const pageClasses = ['page'];
  if (page.section === 'capa') pageClasses.push('cover-page');
  if (page.section === 'capitulo') pageClasses.push('chapter-page');
  pageClasses.push(...buildLayoutClassNames(layout));

  const visualTitle = data.layoutHeading || page.title || '';
  const visualSubtitle = data.layoutSubheading || '';
  const layoutAttributes = buildLayoutAttributes(layout);

  return `
    <section class="${pageClasses.join(' ')} section-${escapeHtml(page.section)}"${layoutAttributes}>
      <div class="page-number" aria-label="${escapeHtml(chrome.pageLabel)}">
        <span class="page-number-label">${escapeHtml(chrome.pageBadgeDetail || 'Página')}</span>
        <span class="page-number-value">${escapeHtml(chrome.pageBadgeValue || '')}</span>
      </div>
      <header class="page-header">
        <div class="page-heading">
          <div class="page-eyebrow">${escapeHtml(chrome.sectionLabel)}</div>
          <h1 class="page-title">${escapeHtml(visualTitle)}</h1>
          ${visualSubtitle ? `<div class="page-subtitle">${escapeHtml(visualSubtitle)}</div>` : ''}
          ${chrome.rankingBadge ? `<div class="page-ranking-badge">${escapeHtml(chrome.rankingBadge)}</div>` : ''}
        </div>
      </header>
      <div class="page-content">
        ${renderPageContent(page, charts, theme, layoutProfile, options.assetResolver)}
      </div>
      <footer class="page-footer">
        <div>${escapeHtml(chrome.editionLabel)}</div>
        <div class="page-footer-center">${escapeHtml(chrome.footerCenter)}</div>
        <div class="page-footer-right">${escapeHtml(chrome.footerRight || chrome.pageLabel)}</div>
      </footer>
    </section>
  `;
}

function renderFramedPage(page, charts, theme, metadata, options, chrome) {
  if (
    page.section !== 'escola'
    && page.section !== 'escola_disciplinas'
    && page.section !== 'ranking'
    && page.section !== 'habilidades_disciplina'
  ) {
    return renderLegacyPage(page, charts, theme, metadata, options, chrome);
  }

  const data = page.data || {};
  const layout = page.layout || {};
  const pageClasses = ['page'];
  pageClasses.push(...buildLayoutClassNames(layout));

  const layoutAttributes = buildLayoutAttributes(layout);
  const layoutProfile = resolveLayoutProfile(page, resolvePageChromeSpec(page));
  const frameHeadingId = `page-frame-title-${Number(page.pageNumber || 0) || 'x'}`;
  const framedMeta = [
    chrome.sectionLabel,
    chrome.pageLabel,
    chrome.footerCenter,
    chrome.footerRight,
    chrome.rankingBadge,
  ].filter(Boolean).join(' • ');

  return `
    <section class="${pageClasses.join(' ')} section-${escapeHtml(page.section)}"${layoutAttributes} aria-labelledby="${frameHeadingId}">
      <div class="framed-page-meta sr-only">${escapeHtml(framedMeta)}</div>
      <div class="page-content page-content-framed">
        <h1 class="sr-only" id="${frameHeadingId}">${escapeHtml(data.layoutHeading || page.title || chrome.sectionLabel || 'Página')}</h1>
        ${renderPageContent(page, charts, theme, layoutProfile, options.assetResolver)}
      </div>
    </section>
  `;
}

function renderPageContent(page, charts, theme, layoutProfile = null, assetResolver = null) {
  const { section, data } = page;
  const layout = page.layout || {};
  const profile = layoutProfile || resolveLayoutProfile(page, { mode: layout.chromeMode || 'legacy' });

  switch (profile.contentRendererKey) {
    case 'cover':
      return renderCoverContent(page, assetResolver);
    case 'chapter':
      return renderChapterContent(page, assetResolver);
    case 'analytical':
      return renderAnalyticalContent(page, charts, theme);
    case 'school-summary':
      return renderSchoolSummaryPageContent(page, assetResolver);
    case 'school-comparison':
      return renderSchoolAreaPageContent(page, charts, theme);
    case 'skills':
      return renderHabilidadesContent(page, data, theme);
    case 'sumario':
      return renderTablePanel('Sumário', ['Título', 'Página'], (data.entries || []).map((entry) => [
        escapeHtml(entry.title),
        escapeHtml(String(entry.page)),
      ]));
    case 'presentation':
      return renderPresentationContent(data);
    case 'year-results':
      return renderResultadosAnoContent(page, charts, theme);
    case 'ranking': {
      const rankingStyleFlags = resolvePageStyleFlags(page);
      return [
        renderSectionHero(
          page,
          `Leitura comparativa do ranking escolar em ${data.disciplina || 'disciplina'}.`,
          [
            buildHeroChip('Disciplina', data.disciplina || '—'),
            buildHeroChip('Página', `${Number(data.pageIndex || 0) + 1}/${data.totalPages || 1}`),
            buildHeroChip('Escolas listadas', String((data.rows || []).length)),
          ],
        ),
        renderChartPanels(charts, theme, {
          gridClassName: rankingStyleFlags.isDenseTable ? 'chart-grid dense-table-chart-grid' : 'chart-grid',
          rankingPanelClassName: rankingStyleFlags.isDenseTable ? 'chart-panel-dense-table' : '',
          rankingRowClassName: rankingStyleFlags.isDenseTable ? 'ranking-chart-row-dense' : '',
        }),
        renderTablePanel(
          page.title,
          ['Posição', 'Escola', 'Participação', 'Média'],
          (data.rows || []).map((row) => [
            escapeHtml(String(row.posicao)),
            escapeHtml(row.nome_escola || ''),
            escapeHtml(row.participacao != null ? `${row.participacao}%` : '—'),
            escapeHtml(String(row.media || 0)),
          ]),
          rankingStyleFlags.isDenseTable
            ? {
              panelClassName: 'panel dense-table-panel dense-table-panel-ranking',
              tableClassName: 'data-table dense-table-table',
            }
            : {},
        ),
      ].join('');
    }
  }

  switch (section) {
    case 'contexto_avaliacao':
    case 'participacao_rede':
    case 'metodologia':
      return renderNarrativePageContent(
        page,
        data.body || buildMetodologiaText(data),
        buildNarrativeContextItems(page),
      );
    case 'proximos_passos':
      return renderNarrativePageContent(page, data.body || '', [], renderBulletPanel('Recomendações', data.recommendations || []));
    default:
      return renderTextPanel(page.title, JSON.stringify(data || {}, null, 2));
  }
}

function renderCoverContent(page, assetResolver) {
  const data = page.data || {};
  const cityLabel = data.municipio || data.nomeRede || 'Canoas';
  const edition = [data.ano, data.ciclo].filter(Boolean).join(' • ');
  const editionCode = formatCoverEditionCode(data);
  const layoutShell = resolveLayoutShell(page, 'cover-slab');
  const supportMedia = [];
  if (data.logoUrl) {
    supportMedia.push(`<img class="cover-image" src="${escapeHtml(toAssetSrc(data.logoUrl, assetResolver))}" alt="Logo institucional">`);
  }
  if (data.imagemInstitucional) {
    supportMedia.push(`<img class="cover-image" src="${escapeHtml(toAssetSrc(data.imagemInstitucional, assetResolver))}" alt="Imagem institucional">`);
  }

  return `
    <div class="cover-hero">
      <div class="cover-gear-field" aria-hidden="true">
        ${renderCoverGearSvg('cover-gear cover-gear-large')}
        ${renderCoverGearSvg('cover-gear cover-gear-small')}
        ${renderCoverGearSvg('cover-gear cover-gear-mini')}
      </div>
      <div class="cover-band" data-layout="${escapeHtml(layoutShell)}" data-shell-ref="${escapeHtml(layoutShell)}">
        <div class="cover-kicker">Avaliação Digital</div>
        <h2 class="cover-band-title">Prefeitura de ${escapeHtml(cityLabel)}</h2>
        <p class="cover-powered">Powered by Educacross</p>
        <div class="cover-edition-code">${escapeHtml(editionCode)}</div>
        <div class="cover-brand-footer">
          <div class="cover-brandmark">
            ${renderMunicipalBrandLockup(cityLabel)}
          </div>
          ${supportMedia.length > 0 ? `<div class="cover-support-media">${supportMedia.join('')}</div>` : ''}
        </div>
        <div class="sr-only">
          Book de Resultados
          Dossiê Institucional da Avaliação Educacional
          Relatório de Resultados da Avaliação
          ${escapeHtml(cityLabel)}
          ${escapeHtml(edition)}
        </div>
      </div>
    </div>
  `;
}

function renderChapterContent(page, assetResolver) {
  const data = page.data || {};
  const chapterLabel = buildChapterLabel(data.chapterIndex, data.chapterKey);
  const chapterDisplayIndex = data.chapterDisplayIndex || data.chapterIndex;
  const hasImage = data.imageUrl ? true : false;
  const imageSrc = hasImage ? toAssetSrc(data.imageUrl, assetResolver) : null;
  const overlayImageSrc = data.overlayImageUrl ? toAssetSrc(data.overlayImageUrl, assetResolver) : null;
  const layoutShell = resolveLayoutShell(page, 'chapter-hero-shell');
  const eyebrowHtml = data.chapterEyebrow
    ? `
          <div class="chapter-kicker-block">
            <span class="chapter-kicker-line">${escapeHtml(data.chapterEyebrow)}</span>
            ${data.chapterEyebrowSecondary ? `<span class="chapter-kicker-line-secondary">${escapeHtml(data.chapterEyebrowSecondary)}</span>` : ''}
          </div>`
    : '';

  // Texto triplo overlay (estilo referência p7)
  const titleTriple = data.chapterTitle || '';

  return `
    <div class="chapter-hero chapter-hero-${data.chapterKey ? escapeHtml(String(data.chapterKey)) : 'default'}" data-layout="${escapeHtml(layoutShell)}" data-shell-ref="${escapeHtml(layoutShell)}">
      ${imageSrc
      ? `<img class="chapter-hero-img" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(data.imageAlt || titleTriple)}" /><div class="chapter-hero-img-overlay"></div>`
      : `<div class="chapter-hero-bg-accent" aria-hidden="true"></div>`
    }
      ${overlayImageSrc ? `<img class="chapter-hero-overlay-asset" src="${escapeHtml(overlayImageSrc)}" alt="" aria-hidden="true" />` : ''}
      <div class="chapter-content-inner">
        <div class="chapter-sequence" aria-hidden="true">${escapeHtml(String(chapterDisplayIndex || '').padStart(2, '0'))}</div>
        <div class="chapter-copy-block">
          ${eyebrowHtml}
          <div class="chapter-marker">${escapeHtml(chapterLabel)}</div>
          <div class="chapter-title-triple" aria-hidden="true">
            <span class="chapter-title-ghost">${escapeHtml(titleTriple)}</span>
            <span class="chapter-title-bold">${escapeHtml(titleTriple)}</span>
            <span class="chapter-title-ghost">${escapeHtml(titleTriple)}</span>
          </div>
          <p class="chapter-summary">${escapeHtml(data.summary || '')}</p>
          <div class="chapter-divider"></div>
        </div>
        <h1 class="sr-only">${escapeHtml(titleTriple)}</h1>
      </div>
    </div>
  `;
}

function renderEditorialSplitHighlights(page) {
  const data = page.data || {};

  if (page.section !== 'participacao_rede') {
    return '';
  }

  const items = [
    { label: 'Participação média', value: formatLocalizedPercent(data.participacaoMedia) },
    { label: 'Estudantes avaliados', value: formatLocalizedInteger(data.totalAlunos) },
    { label: 'Escolas', value: formatLocalizedInteger(data.totalEscolas) },
  ].filter((item) => item.value && item.value !== '—');

  if (items.length === 0) {
    return '';
  }

  return `
    <div class="editorial-split-highlight-row">
      ${items.map((item) => `
        <article class="editorial-split-highlight">
          <span class="editorial-split-highlight-label">${escapeHtml(item.label)}</span>
          <strong class="editorial-split-highlight-value">${escapeHtml(item.value)}</strong>
        </article>
      `).join('')}
    </div>
  `;
}

function renderPresentationContent(data) {
  const scopeCopy = `Informações gerais sobre a Avaliação Digital realizada com os alunos do 3º, 4º, 6º, 7º e 8º ano do Ensino Fundamental no ciclo ${data.ciclo || 'vigente'}.`;
  return `
    <div class="institutional-credits">
      <div class="institutional-credits-header">
        <div class="institutional-credits-kicker">Relatório Diagnóstico Educacional</div>
        <div class="institutional-credits-sub">Secretaria Municipal de Educação de ${escapeHtml(data.municipio || '—')}</div>
      </div>
      <div class="institutional-partnership">
        <div class="institutional-partnership-label">Uma parceria:</div>
        <div class="institutional-partnership-logos">
          <div class="institutional-logo institutional-logo-canoas">
            ${renderMunicipalBrandLockup(data.municipio || 'Canoas')}
          </div>
          <div class="institutional-logo-divider" aria-hidden="true"></div>
          <div class="institutional-logo institutional-logo-educacross">
            ${renderEducacrossWordmark()}
          </div>
        </div>
      </div>
      <div class="institutional-credits-copy">
        <p>${escapeHtml(scopeCopy)}</p>
        <p>${escapeHtml(`${data.totalEscolas || 0} escolas e ${data.totalAlunos || 0} estudantes compõem o recorte institucional consolidado neste relatório.`)}</p>
        <span class="institutional-material-note">Material em análise</span>
      </div>
    </div>
  `;
}

function renderAnalyticalContent(page, charts, theme) {
  const blocks = [];
  const sectionHero = renderAnalyticalHero(page);
  if (sectionHero) blocks.push(sectionHero);

  const indicators = renderIndicatorCards(charts, {
    gridClassName:
      page.section === 'visao_geral'
        ? 'indicator-grid overview-indicator-grid'
        : page.section === 'resultados_disciplina'
          ? 'indicator-grid discipline-indicator-grid'
          : 'indicator-grid',
    cardClassNameResolver:
      page.section === 'visao_geral'
        ? resolveOverviewIndicatorCardClass
        : null,
  });
  if (indicators) blocks.push(indicators);

  const distributionChart = findChart(charts, 'distribution');
  const proficienciaComponent = page.data.components && page.data.components.proficiencia
    ? page.data.components.proficiencia
    : page.data.distribuicao
      ? buildProficienciaComponent(page.data.distribuicao, { title: page.title }, theme)
      : null;

  if (page.section === 'visao_geral' || page.section === 'escola') {
    blocks.push(renderPriorityContextBand(page));
    const leftColumnContent = distributionChart
      ? renderDistributionChart(distributionChart, theme, {
        panelClassName: page.section === 'visao_geral' ? 'chart-panel-overview-distribution' : '',
      })
      : '';
    const rightColumnContent = page.section === 'escola'
      ? renderSchoolDisciplineCards(page.data.distribuicaoPorDisciplina, page.data.resultadosPorAno, theme)
      : renderSummaryCallout(
        'Leitura institucional',
        `A rede registra ${formatMaybePercent(page.data.participacaoMedia)} de participação média entre ${page.data.totalAlunos || 0} estudantes e ${page.data.totalEscolas || 0} escolas.`,
        {
          panelClassName: 'panel-overview-summary',
          calloutClassName: 'summary-callout-overview',
        },
      );
    blocks.push(
      renderAnalyticalSplit(
        [leftColumnContent, rightColumnContent].join(''),
        [
          proficienciaComponent
            ? renderProficienciaPanel(proficienciaComponent, {
              panelClassName: page.section === 'visao_geral' ? 'panel panel-overview-proficiencia' : 'panel',
            })
            : '',
          page.section === 'escola'
            ? renderSchoolOperationalPanel(page.data)
            : renderDisciplineSummaryPanel(page.data.mediasPorDisciplina, {
              panelClassName: 'panel panel-overview-discipline-summary',
            }),
        ].join(''),
        resolveLayoutShell(page, page.section === 'visao_geral' ? 'network-overview-shell' : ''),
        page.section === 'visao_geral'
          ? { columnClassNames: ['overview-shell-main', 'overview-shell-aside'] }
          : {},
      ),
    );
  } else {
    blocks.push(renderPriorityContextBand(page));
    blocks.push(
      renderAnalyticalSplit(
        distributionChart ? renderDistributionChart(distributionChart, theme) : renderChartPanels(charts, theme),
        [
          proficienciaComponent ? renderProficienciaPanel(proficienciaComponent) : '',
          renderSummaryCallout(
            'Leitura da disciplina',
            `A área ${page.data.disciplina || 'informada'} registra média ${formatMaybeNumber(page.data.media)} e participação ${formatMaybePercent(page.data.participacao)}.`,
          ),
        ].join(''),
        resolveLayoutShell(page, page.section === 'resultados_disciplina' ? 'discipline-results-shell' : ''),
      ),
    );
  }

  return `
    <div class="priority-template priority-template-${escapeHtml(page.section)}">
      ${blocks.join('')}
    </div>
  `;
}

function renderResultadosAnoContent(page, charts, theme) {
  const blocks = [];
  blocks.push(
    renderSectionHero(
      page,
      `Recorte do ano/série ${page.data.ano} com ranking consolidado das escolas participantes.`,
      [
        buildHeroChip('Ano/Série', page.data.ano || '—'),
        buildHeroChip('Média da rede', formatMaybeNumber(page.data.mediaRede)),
        buildHeroChip('Participação média', formatMaybePercent(page.data.participacaoMedia)),
      ],
    ),
  );
  const indicators = renderIndicatorCards(charts);
  if (indicators) blocks.push(indicators);

  const chartPanels = renderChartPanels(charts, theme);
  if (chartPanels) blocks.push(chartPanels);

  const rows = (page.data.escolas || []).map((row) => [
    escapeHtml(String(row.posicao || '—')),
    escapeHtml(row.nome_escola || ''),
    escapeHtml(row.participacao != null ? `${row.participacao}%` : '—'),
    escapeHtml(row.media != null ? String(row.media) : '—'),
  ]);

  if (rows.length > 0) {
    blocks.push(renderTablePanel(page.title, ['Posição', 'Escola', 'Participação', 'Média'], rows));
  } else {
    blocks.push(renderTextPanel(page.title, 'Nenhuma escola com resultados disponíveis para este ano/série.'));
  }

  return blocks.join('');
}

/**
 * Editorial split layout — clona o visual do PDF de referência (pág 14)
 * Layout: 58% esquerda (bloco visual) | 42% direita (cabeçalho + título + corpo)
 */
function renderEditorialNarrativePage(page, chrome, assetResolver) {
  const data = page.data || {};
  const sectionTitles = {
    participacao_rede: { chapterTitle: 'Dados Gerais', chapterSubtitle: 'Participação', footer: 'Avaliação Digital' },
    contexto_avaliacao: { chapterTitle: 'Dados Gerais', chapterSubtitle: 'Contextualização', footer: 'Avaliação Digital' },
    metodologia: { chapterTitle: 'Dados Gerais', chapterSubtitle: 'Metodologia', footer: 'Avaliação Digital' },
  };
  const titles = sectionTitles[page.section] || { chapterTitle: data.layoutHeading || page.title || '', chapterSubtitle: data.layoutSubheading || '', footer: 'Avaliação Digital' };

  const bodyText = data.body || '';

  // Quebra o texto em parágrafos por ponto-final + espaço ou por \n
  const paragraphs = bodyText
    .split(/\n|(?<=\.)(?=\s+[A-Z])/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const paragraphsHtml = paragraphs.length > 0
    ? paragraphs.map((p) => `<p class="editorial-split-text">${escapeHtml(p)}</p>`).join('')
    : `<p class="editorial-split-text">${escapeHtml(bodyText)}</p>`;
  const highlightsHtml = renderEditorialSplitHighlights(page);

  const pageNum = chrome && chrome.pageBadgeValue ? chrome.pageBadgeValue : '';
  const footerLabel = titles.footer;
  const imageSrc = data.imageUrl ? toAssetSrc(data.imageUrl, assetResolver) : null;

  if (page.section === 'participacao_rede') {
    const participacaoParagraphs = Array.isArray(data.paragraphs) && data.paragraphs.length > 0
      ? data.paragraphs
      : paragraphs;
    const participacaoParagraphsHtml = participacaoParagraphs
      .map((paragraph) => `<p class="participacao-editorial-paragraph">${escapeHtml(paragraph)}</p>`)
      .join('');

    return `
      <div class="participacao-editorial">
        <div class="participacao-editorial-media">
          ${imageSrc
        ? `<img class="participacao-editorial-image" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(data.imageAlt || titles.chapterSubtitle || titles.chapterTitle)}" />`
        : `<div class="participacao-editorial-placeholder">
              <svg width="92" height="92" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="60" cy="60" r="52" stroke="#133D59" stroke-width="4"/>
                <path d="M38 80c0-12 10-22 22-22s22 10 22 22" stroke="#133D59" stroke-width="4" stroke-linecap="round"/>
                <circle cx="60" cy="44" r="12" stroke="#133D59" stroke-width="4"/>
              </svg>
            </div>`}
        </div>
        <div class="participacao-editorial-copy">
          <div class="participacao-editorial-kicker">
            <span class="participacao-editorial-kicker-primary">${escapeHtml(titles.chapterTitle)}</span>
            <span class="participacao-editorial-kicker-secondary">${escapeHtml(titles.chapterSubtitle)}</span>
          </div>
          <div class="participacao-editorial-rule" aria-hidden="true"></div>
          <div class="participacao-editorial-body">
            ${participacaoParagraphsHtml}
            <span class="participacao-editorial-dot" aria-hidden="true"></span>
          </div>
          <div class="participacao-editorial-footer">
            <span class="participacao-editorial-footer-label">${escapeHtml(footerLabel)}</span>
            ${pageNum ? `<span class="editorial-split-page-num">${escapeHtml(pageNum)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="editorial-split">
      <div class="editorial-split-visual">
        ${imageSrc
      ? `<img class="editorial-split-visual-img" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(data.imageAlt || titles.chapterSubtitle || titles.chapterTitle)}" /><div class="editorial-split-visual-overlay"></div>`
      : `<div class="editorial-split-visual-placeholder">
          <svg width="80" height="80" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="opacity:0.25">
            <circle cx="60" cy="60" r="52" stroke="#133D59" stroke-width="4"/>
            <path d="M38 80c0-12 10-22 22-22s22 10 22 22" stroke="#133D59" stroke-width="4" stroke-linecap="round"/>
            <circle cx="60" cy="44" r="12" stroke="#133D59" stroke-width="4"/>
          </svg>
        </div>`}
        <div class="editorial-split-visual-accent"></div>
      </div>
      <div class="editorial-split-content">
        <div class="editorial-split-header">Relatório Diagnóstico Educacional</div>
        <div class="editorial-split-chapter">
          <h1 class="editorial-split-chapter-title">${escapeHtml(titles.chapterTitle)}</h1>
          <h2 class="editorial-split-chapter-subtitle">${escapeHtml(titles.chapterSubtitle)}</h2>
          ${highlightsHtml}
        </div>
        <div class="editorial-split-body">
          ${paragraphsHtml}
          <span class="editorial-split-bullet" aria-hidden="true"></span>
        </div>
        <div class="editorial-split-footer">
          <span class="editorial-split-footer-label">${escapeHtml(footerLabel)}</span>
          ${pageNum ? `<span class="editorial-split-page-num">${escapeHtml(pageNum)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderEditorialTablePage(page, chrome) {
  const data = page.data || {};
  const columns = data.columns || [];
  const rows = data.rows || [];
  const disciplineKey = escapeHtml(String(data.disciplineKey || 'default'));

  const headerCells = columns.map((column) => {
    const className = column.numeric ? ' class="editorial-table-th-numeric"' : '';
    return `<th scope="col"${className}>${escapeHtml(column.label || '')}</th>`;
  }).join('');

  const bodyRows = rows.map((row) => `
      <tr>
        ${columns.map((column) => renderEditorialTableCell(row, column)).join('')}
      </tr>
    `).join('');

  return `
    <div class="editorial-table-page">
      <div class="editorial-table-page-header">
        <div class="editorial-table-page-kicker">Relatório Diagnóstico Educacional</div>
      </div>

      <section class="editorial-table-section" aria-labelledby="editorial-table-title-${escapeHtml(String(page.pageNumber || 0))}">
        <div class="editorial-table-header-row" data-discipline="${disciplineKey}">
          <div id="editorial-table-title-${escapeHtml(String(page.pageNumber || 0))}">${escapeHtml(data.tableTitle || 'Participação consolidada por escola')}</div>
        </div>
        <table class="editorial-table">
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </section>

      <div class="editorial-table-page-footer">
        <span>Avaliação Digital</span>
        <span>${escapeHtml(chrome.pageBadgeValue || String(page.pageNumber || ''))}</span>
      </div>
    </div>
  `;
}

function renderEditorialTableCell(row, column) {
  const value = getEditorialTableCellValue(row, column);
  const cellClasses = [];
  if (column.numeric) cellClasses.push('editorial-table-cell-numeric');
  if (column.key === 'nomeEscola') cellClasses.push('editorial-table-school-name');
  const classAttribute = cellClasses.length > 0 ? ` class="${cellClasses.join(' ')}"` : '';
  return `<td${classAttribute}>${escapeHtml(value)}</td>`;
}

function getEditorialTableCellValue(row, column) {
  if (!column || !row) return '—';

  const value = row[column.key];

  if (column.type === 'integer') return formatLocalizedInteger(value);
  if (column.type === 'percent') return formatLocalizedPercent(value);
  if (value == null || value === '') return '—';
  return String(value);
}

function renderIndicatorCards(charts, options = {}) {
  const indicators = (charts || []).filter((chart) => chart.type === 'indicator');
  if (indicators.length === 0) return '';
  const cardsHtml = indicators
    .map(
      (card, index) => {
        const extraClassName = typeof options.cardClassNameResolver === 'function'
          ? options.cardClassNameResolver(card, index)
          : '';
        const cardClassName = ['indicator-card', extraClassName].filter(Boolean).join(' ');
        return `
        <article class="${escapeHtml(cardClassName)}">
          <div class="value">${escapeHtml(String(card.valor))}</div>
          <div class="label">${escapeHtml(card.titulo)}</div>
        </article>
      `;
      },
    )
    .join('');

  return `
    <div class="${escapeHtml(options.gridClassName || 'indicator-grid')}">
      ${cardsHtml}
    </div>
  `;
}

function renderChartPanels(charts, theme, options = {}) {
  const chartBlocks = (charts || [])
    .filter((chart) => chart.type !== 'indicator')
    .map((chart) => renderChartPanel(chart, theme, options))
    .filter(Boolean);

  if (chartBlocks.length === 0) {
    return '';
  }

  return `<div class="${escapeHtml(options.gridClassName || 'chart-grid')}">${chartBlocks.join('')}</div>`;
}

function renderChartPanel(chart, theme, options = {}) {
  switch (chart.type) {
    case 'distribution':
      return renderDistributionChart(chart, theme);
    case 'ranking':
      return renderRankingChart(chart, options);
    case 'comparativo_chart':
      return renderComparativoChart(chart, theme);
    default:
      return '';
  }
}

function renderDistributionChart(chart, theme, options = {}) {
  const panelClassName = ['chart-panel', 'chart-panel-distribution', options.panelClassName]
    .filter(Boolean)
    .join(' ');
  const segments = (chart.series || [])
    .map((series) => {
      const width = Math.max(4, Number(series.percentual || 0));
      const color = resolveLevelColor(series.nivel, theme, series.color);
      return `
        <div class="distribution-segment" style="width:${width}%;background:${escapeHtml(color)}">
          ${escapeHtml(`${series.percentual}%`)}
        </div>
      `;
    })
    .join('');

  const legend = (chart.series || [])
    .map(
      (series) => `
        <div class="distribution-legend-item">
          <span class="legend-swatch" style="background:${escapeHtml(resolveLevelColor(series.nivel, theme, series.color))}"></span>
          <span>${escapeHtml(`${series.label}: ${series.alunos} alunos (${series.percentual}%)`)}</span>
        </div>
      `,
    )
    .join('');

  return `
    <section class="${escapeHtml(panelClassName)}">
      <h3 class="chart-title">${escapeHtml(chart.title || 'Distribuição')}</h3>
      <div class="distribution-stack">${segments}</div>
      <div class="distribution-legend">${legend}</div>
    </section>
  `;
}

function renderRankingChart(chart, options = {}) {
  const maxValue = chart.maxValue || 0;
  const panelClassName = ['chart-panel', 'chart-panel-ranking', options.rankingPanelClassName]
    .filter(Boolean)
    .join(' ');
  const rowClassName = ['ranking-chart-row', options.rankingRowClassName]
    .filter(Boolean)
    .join(' ');
  const rows = (chart.bars || [])
    .map((bar) => {
      const width = maxValue > 0 ? Math.max(3, (Number(bar.value || 0) / maxValue) * 100) : 0;
      return `
        <div class="${escapeHtml(rowClassName)}">
          <div class="ranking-label">${escapeHtml(`${bar.posicao}º • ${bar.label}`)}</div>
          <div class="chart-track">
            <div class="chart-bar" style="width:${width}%;background:${escapeHtml(bar.color)}"></div>
          </div>
          <div class="chart-value">${escapeHtml(String(bar.value))}</div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="${escapeHtml(panelClassName)}">
      <h3 class="chart-title">${escapeHtml(chart.title || 'Ranking')}</h3>
      ${rows}
    </section>
  `;
}

function renderComparativoChart(chart, theme) {
  const colors = createComparativoColors(theme);
  const maxValue = chart.maxValue || Math.max(...(chart.pairs || []).flatMap((pair) => [
    Number(pair.escola.value || 0),
    Number(pair.rede.value || 0),
  ]), 0);

  const rows = (chart.pairs || [])
    .map((pair) => {
      const escolaColor = pair.escola.color || colors.escola;
      const redeColor = pair.rede.color || colors.rede;
      const escolaWidth = maxValue > 0 ? Math.max(3, (Number(pair.escola.value || 0) / maxValue) * 100) : 0;
      const redeWidth = maxValue > 0 ? Math.max(3, (Number(pair.rede.value || 0) / maxValue) * 100) : 0;

      return `
        <div class="comparativo-chart-row">
          <div class="comparativo-label">${escapeHtml(pair.label)}</div>
          <div class="comparativo-bars">
            <div class="comparativo-bar-line">
              <span class="series-label">Escola</span>
              <div class="chart-track">
                <div class="chart-bar" style="width:${escolaWidth}%;background:${escapeHtml(escolaColor)}"></div>
              </div>
            </div>
            <div class="comparativo-bar-line">
              <span class="series-label">Rede</span>
              <div class="chart-track">
                <div class="chart-bar" style="width:${redeWidth}%;background:${escapeHtml(redeColor)}"></div>
              </div>
            </div>
          </div>
          <div class="chart-value comparativo-delta" style="color:${escapeHtml(pair.delta.color || colors.deltaNeutral)}">
            ${escapeHtml(formatDeltaValue(pair.delta.value))}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="chart-panel chart-panel-comparativo">
      <h3 class="chart-title">${escapeHtml(chart.title || 'Comparativo')}</h3>
      ${rows}
    </section>
  `;
}

function renderProficienciaPanel(component, options = {}) {
  const rows = (component.bars || []).map((bar) => [
    {
      text: escapeHtml(bar.label),
      className: `level-cell proficiency-${escapeHtml(bar.nivel)}`,
    },
    escapeHtml(String(bar.alunos)),
    escapeHtml(`${bar.percentual}%`),
  ]);

  rows.push([{ text: 'Total', className: '' }, escapeHtml(String(component.total || 0)), '100%']);

  return renderTablePanel(component.title || 'Distribuição de Proficiência', ['Nível', 'Alunos', '%'], rows, options);
}

function renderComparativoContent(data, theme) {
  const component =
    (data.components || {}).comparativo ||
    buildComparativoComponent(data.participacaoPorDisciplina || [], { title: 'Comparativo Escola vs. Rede' }, theme);

  const rows = (component.rows || []).map((row) => [
    escapeHtml(row.disciplina || ''),
    escapeHtml(row.escola.media != null ? String(row.escola.media) : '—'),
    escapeHtml(row.rede.media != null ? String(row.rede.media) : '—'),
    {
      text: escapeHtml(row.delta.mediaFormatted || '—'),
      className: getDeltaClass(row.delta.media),
    },
    escapeHtml(row.escola.participacao != null ? `${row.escola.participacao}%` : '—'),
    escapeHtml(row.rede.participacao != null ? `${row.rede.participacao}%` : '—'),
  ]);

  return renderTablePanel(
    component.title || 'Comparativo Escola vs. Rede',
    ['Disciplina', 'Média Escola', 'Média Rede', 'Δ Média', 'Part. Escola', 'Part. Rede'],
    rows,
  );
}

function renderHabilidadesContent(page, data, theme) {
  const styleFlags = resolvePageStyleFlags(page);
  const pageIndex = Number.isInteger(data.pageIndex) ? data.pageIndex : 0;
  const component =
    (data.components || {}).tabela ||
    buildHabilidadesTable(
      data.rows || [],
      { title: `Habilidades — ${data.disciplina || 'Geral'}`, columns: ['codigo', 'descricao', 'percentualAcerto'] },
      theme,
    );
  const pagination = component.totalPages > 1
    ? `<div class="muted${styleFlags.isDenseTable ? ' dense-table-pagination' : ''}">${escapeHtml(`${pageIndex + 1} / ${component.totalPages} páginas • ${component.totalRows} habilidades no total`)}</div>`
    : `<div class="muted${styleFlags.isDenseTable ? ' dense-table-pagination' : ''}">${escapeHtml(`${component.totalRows} habilidades`)}</div>`;
  const contextItems = [
    { label: 'Área / Disciplina', value: data.disciplina || '—' },
    { label: 'Total de habilidades', value: String(component.totalRows) },
    { label: 'Paginação', value: `${pageIndex + 1} / ${component.totalPages}` },
  ];
  const hero = renderSectionHero(
    { title: data.layoutHeading || `Habilidades — ${data.disciplina || 'Geral'}` },
    `Leitura detalhada das habilidades avaliadas em ${data.disciplina || 'área informada'}.`,
    [
      buildHeroChip('Disciplina', data.disciplina || '—'),
      buildHeroChip('Total', String(component.totalRows)),
      buildHeroChip('Página', `${pageIndex + 1}/${component.totalPages}`),
    ],
  );

  return `
    ${hero}
    ${renderContextStrip(contextItems, styleFlags.isDenseTable ? 'dense-table-context-strip' : '')}
    ${pagination}
    ${renderHabilidadesTablePanel(component, pageIndex, styleFlags.isDenseTable ? {
    panelClassName: 'panel dense-table-panel dense-table-panel-skills',
    tableClassName: 'skills-table dense-table-table',
  } : {})}
  `;
}

function renderNarrativePageContent(page, bodyText, contextItems = [], extraContent = '') {
  const blocks = [
    renderSectionHero(
      page,
      bodyText,
      (contextItems || []).map((item) => buildHeroChip(item.label, item.value)),
    ),
  ];

  if (contextItems && contextItems.length > 0) {
    blocks.push(renderNarrativeContextStrip(contextItems));
  }

  if (bodyText) {
    blocks.push(renderTextPanel(page.title, bodyText));
  }

  if (extraContent) {
    blocks.push(extraContent);
  }

  return `<div class="narrative-flow">${blocks.join('')}</div>`;
}

function renderSectionHero(page, copy, chips = []) {
  let options = {};
  if (chips && !Array.isArray(chips)) {
    options = chips || {};
    chips = options.chips || [];
  }

  const title = (page && page.data && page.data.layoutHeading) || page.title || '';
  const subtitle = page && page.data ? page.data.layoutSubheading : '';
  const copyText = copy || subtitle || '';
  const chipHtml = (chips || []).filter(Boolean).join('');
  const emphasis = options.emphasis || null;
  const emphasisHtml = emphasis
    ? `
      <div class="hero-panel-emphasis">
        ${emphasis.label ? `<span class="hero-panel-emphasis-label">${escapeHtml(emphasis.label)}</span>` : ''}
        ${emphasis.value ? `<strong class="hero-panel-emphasis-value">${escapeHtml(emphasis.value)}</strong>` : ''}
        ${emphasis.note ? `<span class="hero-panel-emphasis-note">${escapeHtml(emphasis.note)}</span>` : ''}
      </div>
    `
    : '';
  const panelClassName = ['hero-panel', options.panelClassName].filter(Boolean).join(' ');

  return `
    <section class="${panelClassName}">
      ${options.kicker ? `<div class="hero-panel-kicker">${escapeHtml(options.kicker)}</div>` : ''}
      <div class="hero-panel-grid">
        <div class="hero-panel-main">
          <h2 class="hero-panel-title">${escapeHtml(title)}</h2>
          ${subtitle ? `<div class="page-subtitle">${escapeHtml(subtitle)}</div>` : ''}
          ${copyText ? `<p class="hero-panel-copy">${escapeHtml(copyText)}</p>` : ''}
        </div>
        ${emphasisHtml}
      </div>
      ${chipHtml ? `<div class="hero-kpi-row">${chipHtml}</div>` : ''}
      ${options.footnote ? `<div class="hero-panel-footnote">${escapeHtml(options.footnote)}</div>` : ''}
    </section>
  `;
}

function buildHeroChip(label, value) {
  if (value == null || value === '') {
    return '';
  }

  return `
    <span class="hero-kpi-chip">
      <span>${escapeHtml(label || '')}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </span>
  `;
}

function renderAnalyticalHero(page) {
  switch (page.section) {
    case 'visao_geral':
      return renderSectionHero(
        page,
        'Panorama consolidado da rede com participação média, proficiência e leitura por disciplina.',
        {
          kicker: 'Panorama institucional',
          panelClassName: 'hero-panel-overview',
          emphasis: {
            label: 'Média geral',
            value: formatMaybeNumber(page.data.mediaGeral),
            note: `${formatMaybePercent(page.data.participacaoMedia)} de participação média`,
          },
          chips: [
            buildHeroChip('Município', page.data.municipio || '—'),
            buildHeroChip('Escolas', String(page.data.totalEscolas || 0)),
            buildHeroChip('Estudantes', String(page.data.totalAlunos || 0)),
          ],
        },
      );
    case 'resultados_disciplina':
      return renderSectionHero(
        page,
        `Resultado consolidado da área ${page.data.disciplina || 'informada'} com comparação de média e participação.`,
        {
          kicker: 'Resultados por área',
          panelClassName: 'hero-panel-discipline',
          emphasis: {
            label: 'Disciplina',
            value: page.data.disciplina || '—',
            note: `${formatMaybeNumber(page.data.media)} de média • ${formatMaybePercent(page.data.participacao)} de participação`,
          },
          chips: [
            buildHeroChip('Disciplina', page.data.disciplina || '—'),
            buildHeroChip('Média', formatMaybeNumber(page.data.media)),
            buildHeroChip('Participação', formatMaybePercent(page.data.participacao)),
          ],
        },
      );
    case 'escola':
      return renderSectionHero(
        page,
        page.data.sintese || 'Leitura geral da escola com foco em participação, média e distribuição de proficiência.',
        [
          buildHeroChip('Média da escola', formatMaybeNumber(page.data.media)),
          buildHeroChip('Média da rede', formatMaybeNumber(page.data.mediaRede)),
          buildHeroChip('Participação', formatMaybePercent((page.data.operacional || {}).participacaoTotal ?? page.data.participacao)),
        ],
      );
    default:
      return '';
  }
}

function resolveOverviewIndicatorCardClass(card) {
  const titleToken = normalizeClassToken(card && card.titulo);
  const classNameByTitle = {
    'total-de-escolas': 'indicator-card-total-escolas',
    'total-de-estudantes': 'indicator-card-total-estudantes',
    'participacao-media': 'indicator-card-participacao-media',
    'media-geral': 'indicator-card-media-geral',
  };

  return classNameByTitle[titleToken] || '';
}

function renderPriorityContextBand(page) {
  let items = [];

  if (page.section === 'visao_geral') {
    items = [
      { label: 'Município', value: page.data.municipio || '—', className: 'priority-context-card-municipio' },
      { label: 'Escolas', value: String(page.data.totalEscolas || 0), className: 'priority-context-card-escolas' },
      { label: 'Disciplinas', value: String(Object.keys(page.data.mediasPorDisciplina || {}).length), className: 'priority-context-card-disciplinas' },
      { label: 'Referência visual', value: 'Book atual', className: 'priority-context-card-referencia' },
    ];
  } else if (page.section === 'resultados_disciplina') {
    items = [
      { label: 'Disciplina', value: page.data.disciplina || '—' },
      { label: 'Média da rede', value: formatMaybeNumber(page.data.media) },
      { label: 'Participação', value: formatMaybePercent(page.data.participacao) },
      { label: 'Referência visual', value: 'Book atual' },
    ];
  }

  if (items.length === 0) {
    return '';
  }

  return `
    <section class="priority-context-band">
      ${items.map((item) => `
        <article class="${escapeHtml(['priority-context-card', item.className].filter(Boolean).join(' '))}">
          <div class="priority-context-label">${escapeHtml(item.label || '')}</div>
          <div class="priority-context-value">${escapeHtml(item.value || '—')}</div>
        </article>
      `).join('')}
    </section>
  `;
}

function renderSchoolSummaryPageContent(page, assetResolver = null) {
  const data = page.data || {};
  const operacional = data.operacional || {};
  const disciplineHighlights = buildSchoolAreaHighlights(data);
  const participationRows = buildSchoolParticipationRows(data);
  const participationValue = formatLocalizedPercent(operacional.participacaoTotal ?? data.participacao, 2);
  const summaryNarrative = buildSchoolPerformanceNarrative(data, disciplineHighlights);
  const layoutShell = resolveLayoutShell(page, 'school-summary-shell');
  const owlAsset = toAssetSrc(resolveSchoolMascotAsset(data), assetResolver);

  return `
    <div class="analytic-split" data-layout="${escapeHtml(layoutShell)}">
      <section class="school-summary-aside">
        <div class="school-brand-block">
          <div class="school-brand-eyebrow">${escapeHtml(data.schoolEyebrowPrefix || 'SME')} ${escapeHtml(data.municipio || 'Canoas')}</div>
        </div>
        <div class="school-hero-figure" aria-hidden="true">
          <div class="school-owl-wrap">
            <img class="school-owl-image" src="${escapeHtml(owlAsset)}" alt="Mascote institucional" />
          </div>
        </div>
        <h2 class="school-name-display">${escapeHtml(data.nome_escola || 'Escola')}</h2>
        <div class="school-kpi-grid">
          <article class="school-kpi-card">
            <div class="school-kpi-value">${escapeHtml(formatLocalizedInteger(operacional.iniciaram ?? data.totalAlunos))}</div>
            <div class="school-kpi-label">Alunos iniciaram</div>
            <div class="school-kpi-note">(Pelo menos 1 das provas)</div>
          </article>
          <article class="school-kpi-card">
            <div class="school-kpi-value">${escapeHtml(formatLocalizedInteger(operacional.finalizaram ?? data.totalAlunos))}</div>
            <div class="school-kpi-label">Alunos finalizaram</div>
            <div class="school-kpi-note">(Todas as provas)</div>
          </article>
        </div>
        <table class="summary-table school-operational-table">
          <thead>
            <tr>
              <th></th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Alunos previstos</td>
              <td>${escapeHtml(formatLocalizedInteger(operacional.previstos ?? data.totalAlunos))}</td>
            </tr>
            <tr class="school-table-section-row">
              <td colspan="2">Participação por competência</td>
            </tr>
            ${participationRows.map((row) => `
              <tr>
                <td>${escapeHtml(row.disciplina)}</td>
                <td>${escapeHtml(formatLocalizedInteger(row.total))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="school-participation-feature">
          <div class="school-participation-number">${escapeHtml(participationValue)}</div>
          <div class="school-participation-label">de participação</div>
        </div>
        <div class="sr-only">Previstos Iniciaram Finalizaram Participação Total</div>
        ${data.rankingPosition ? `<div class="sr-only">${escapeHtml(`Posição Geral: ${data.rankingPosition}º`)}</div>` : ''}
        <div class="sr-only">${escapeHtml(`Distribuição de Proficiência — ${data.nome_escola || ''}`)}</div>
      </section>
      <section class="school-summary-main">
        <p class="school-summary-copy">${escapeHtml(summaryNarrative)}</p>
        <div class="school-stat-bubbles">
          ${disciplineHighlights.map((highlight) => renderSchoolStatBubble(highlight)).join('')}
        </div>
        <div class="sr-only">${escapeHtml(data.sintese || '')}</div>
      </section>
    </div>
  `;
}

function renderSchoolAreaPageContent(page, charts, theme) {
  const data = page.data || {};
  const areaRows = buildReferenceAreaRows(data);
  const layoutShell = resolveLayoutShell(page, 'school-comparison-shell');
  const networkLabel = data.schoolEyebrowPrefix || 'SME';

  return `
    <section class="reference-school-area" data-layout="${escapeHtml(layoutShell)}">
      <div class="reference-school-area-grid">
        ${areaRows.map((row) => renderReferenceDisciplineModule(row, theme, networkLabel)).join('')}
      </div>
      <div class="reference-area-legend">
        ${renderReferenceLegendItem('Abaixo do Básico', 'abaixo_do_basico', theme)}
        ${renderReferenceLegendItem('Básico', 'basico', theme)}
        ${renderReferenceLegendItem('Adequado', 'adequado', theme)}
        ${renderReferenceLegendItem('Avançado', 'avancado', theme)}
      </div>
    </section>
    ${renderComparativoContent(data, theme)}
  `;
}

function renderSchoolOperationalPanel(data) {
  const operacional = data.operacional || {};
  const chips = [
    buildHeroChip('Previstos', operacional.previstos != null ? operacional.previstos : data.totalAlunos),
    buildHeroChip('Iniciaram', operacional.iniciaram != null ? operacional.iniciaram : data.totalAlunos),
    buildHeroChip('Finalizaram', operacional.finalizaram != null ? operacional.finalizaram : data.totalAlunos),
    buildHeroChip('Participação total', formatMaybePercent(operacional.participacaoTotal ?? data.participacao)),
  ].join('');

  const callout = `A média geral da escola está em ${formatMaybeNumber(data.media)} pontos, frente a ${formatMaybeNumber(data.mediaRede)} pontos da rede.`;

  return `
    <section class="panel">
      <h2 class="panel-title">Leitura operacional da escola</h2>
      <div class="hero-kpi-row">${chips}</div>
      <div class="summary-callout">${escapeHtml(callout)}</div>
    </section>
  `;
}

function renderSchoolDisciplineCards(distribuicaoPorDisciplina, resultadosPorAno, theme) {
  const resultMap = new Map(
    (resultadosPorAno || []).map((row) => [String(row.disciplina || '').trim(), row]),
  );
  const cards = Object.entries(distribuicaoPorDisciplina || {})
    .map(([disciplina, distribuicao]) => {
      const resultado = resultMap.get(String(disciplina).trim()) || {};
      return `
        <article class="school-discipline-card">
          <div class="school-discipline-header">Área do conhecimento</div>
          <h3 class="school-discipline-title">${escapeHtml(disciplina)}</h3>
          <div class="school-discipline-metrics">
            ${buildHeroChip('Média', formatMaybeNumber(resultado.media))}
            ${buildHeroChip('Participação', formatMaybePercent(resultado.participacao))}
          </div>
          ${renderMiniDistribution(distribuicao, theme)}
        </article>
      `;
    })
    .join('');

  if (!cards) {
    return '';
  }

  return `
    <section class="panel">
      <h2 class="panel-title">Proficiência por área do conhecimento</h2>
      <div class="school-discipline-grid">${cards}</div>
    </section>
  `;
}

function _renderAreaPerformanceCards(data, theme) {
  const component =
    (data.components || {}).comparativo ||
    buildComparativoComponent(data.participacaoPorDisciplina || [], { title: 'Comparativo Escola vs. Rede' }, theme);
  const distribuicaoPorDisciplina = data.distribuicaoPorDisciplina || {};
  const cards = (component.rows || [])
    .map((row) => {
      const distribuicao = distribuicaoPorDisciplina[row.disciplina];
      return `
        <article class="area-card">
          <div class="area-card-eyebrow">Área do conhecimento</div>
          <h3 class="area-card-title">${escapeHtml(row.disciplina || '—')}</h3>
          <div class="area-card-scores">
            <span class="score-pill score-pill-school">Escola <strong>${escapeHtml(formatMaybeNumber(row.escola.media))}</strong></span>
            <span class="score-pill score-pill-network">Rede <strong>${escapeHtml(formatMaybeNumber(row.rede.media))}</strong></span>
            <span class="score-pill score-pill-delta ${getDeltaClass(row.delta.media)}">Δ <strong>${escapeHtml(row.delta.mediaFormatted || '—')}</strong></span>
          </div>
          ${distribuicao ? renderMiniDistribution(distribuicao, theme) : ''}
          <div class="area-card-meta">
            <span>Participação da escola: ${escapeHtml(formatMaybePercent(row.escola.participacao))}</span>
            <span>Participação da rede: ${escapeHtml(formatMaybePercent(row.rede.participacao))}</span>
          </div>
        </article>
      `;
    })
    .join('');

  if (!cards) {
    return '';
  }

  return `
    <section class="panel">
      <h2 class="panel-title">Proficiência e habilidades por área do conhecimento</h2>
      <div class="area-card-grid">${cards}</div>
    </section>
  `;
}

function renderMiniDistribution(distribuicao, theme) {
  const levels = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
  const row = levels
    .map((level) => {
      const percentual = Number(((distribuicao.percentuais || {})[level]) || 0);
      return `<span class="mini-distribution-fill" style="width:${Math.max(percentual, 4)}%;background:${escapeHtml(resolveLevelColor(level, theme))}"></span>`;
    })
    .join('');
  const legend = levels
    .map((level) => `<span>${escapeHtml(formatLevelLabel(level))}: ${escapeHtml(formatMaybePercent((distribuicao.percentuais || {})[level]))}</span>`)
    .join('');

  return `
    <div class="mini-distribution">
      <div class="mini-distribution-row">${row}</div>
      <div class="mini-distribution-legend">${legend}</div>
    </div>
  `;
}

function renderSummaryCallout(title, text, options = {}) {
  if (!text) {
    return '';
  }

  const panelClassName = ['panel', options.panelClassName].filter(Boolean).join(' ');
  const calloutClassName = ['summary-callout', options.calloutClassName].filter(Boolean).join(' ');

  return `
    <section class="${escapeHtml(panelClassName)}">
      <h2 class="panel-title">${escapeHtml(title || '')}</h2>
      <div class="${escapeHtml(calloutClassName)}">${escapeHtml(text)}</div>
    </section>
  `;
}

function buildNarrativeContextItems(page) {
  const data = page.data || {};

  switch (page.section) {
    case 'contexto_avaliacao':
      return [
        { label: 'Município', value: data.layoutSubheading || '—' },
        { label: 'Página', value: 'Contexto' },
        { label: 'Formato', value: 'Avaliação Digital' },
      ];
    case 'participacao_rede':
      return [
        { label: 'Município', value: data.layoutSubheading || '—' },
        { label: 'Página', value: 'Participação' },
        { label: 'Leitura', value: 'Rede municipal' },
      ];
    case 'metodologia':
      return [
        { label: 'Município', value: data.municipio || '—' },
        { label: 'Ciclo', value: data.ciclo || '—' },
        { label: 'Disciplinas', value: String((data.disciplinas || []).length) },
      ];
    default:
      return [];
  }
}

function renderNarrativeContextStrip(items) {
  return `
    <section class="context-strip narrative-context-strip">
      ${(items || []).map((item) => `
        <article class="context-item">
          <div class="context-item-label">${escapeHtml(item.label || '')}</div>
          <div class="context-item-value">${escapeHtml(item.value || '—')}</div>
        </article>
      `).join('')}
    </section>
  `;
}

function renderContextStrip(items, className = '') {
  return `
    <section class="context-strip${className ? ` ${escapeHtml(className)}` : ''}">
      ${(items || []).map((item) => `
        <article class="context-item">
          <div class="context-item-label">${escapeHtml(item.label || '')}</div>
          <div class="context-item-value">${escapeHtml(item.value || '—')}</div>
        </article>
      `).join('')}
    </section>
  `;
}

function renderAnalyticalSplit(leftContent, rightContent, layoutName = '', options = {}) {
  const columnClassNames = Array.isArray(options.columnClassNames) ? options.columnClassNames : [];
  const columns = [leftContent, rightContent]
    .map((content, index) => {
      const columnClassName = columnClassNames[index];
      const classAttribute = columnClassName ? ` class="${escapeHtml(columnClassName)}"` : '';
      return `<div${classAttribute}>${content || ''}</div>`;
    })
    .join('');
  const layoutAttribute = layoutName ? ` data-layout="${escapeHtml(layoutName)}"` : '';
  return `<div class="analytic-split"${layoutAttribute}>${columns}</div>`;
}

function buildSchoolParticipationRows(data) {
  const operacional = data.operacional || {};
  const previstos = Number(operacional.previstos ?? data.totalAlunos ?? 0);
  const resultsByDisciplina = new Map(
    (data.resultadosPorAno || []).map((row) => [String(row.disciplina || '').trim(), row]),
  );

  return getDisciplineOrder(data).map((disciplina) => {
    const resultado = resultsByDisciplina.get(disciplina) || {};
    const participacao = Number(resultado.participacao);
    const total = Number.isFinite(participacao)
      ? Math.round((previstos * participacao) / 100)
      : Number(operacional.finalizaram ?? data.totalAlunos ?? 0);

    return {
      disciplina,
      total,
    };
  });
}

function buildSchoolAreaHighlights(data) {
  return getDisciplineOrder(data)
    .map((disciplina) => {
      const distribuicao = ((data.distribuicaoPorDisciplina || {})[disciplina]) || {};
      const percentuais = distribuicao.percentuais || {};
      const proficientes = Number(percentuais.adequado || 0) + Number(percentuais.avancado || 0);
      return {
        disciplina,
        percentual: proficientes,
        ...resolveDisciplineTheme(disciplina),
      };
    })
    .filter((highlight) => Number.isFinite(highlight.percentual))
    .slice(0, 2);
}

function buildSchoolPerformanceNarrative(data, disciplineHighlights) {
  const operacional = data.operacional || {};
  const participationText = operacional.participacaoTotal != null
    ? `A participação foi de ${formatLocalizedPercent(operacional.participacaoTotal, 2)} dos alunos matriculados.`
    : '';
  const highlightsText = (disciplineHighlights || [])
    .map((highlight) => `Em ${highlight.disciplina}, ${formatLocalizedPercent(highlight.percentual, 2)} dos estudantes apresentaram níveis proficientes e avançados.`)
    .join(' ');
  const comparativeText = `A média geral da escola está ${Number(data.media) >= Number(data.mediaRede) ? 'acima' : 'abaixo'} da média da rede (${formatLocalizedNumber(data.media)} vs ${formatLocalizedNumber(data.mediaRede)}).`;

  return [participationText, highlightsText, comparativeText].filter(Boolean).join(' ');
}

function buildReferenceAreaRows(data) {
  const schoolDistributions = data.distribuicaoPorDisciplina || {};
  const networkDistributions = data.redeDistribuicaoPorDisciplina || {};

  return getDisciplineOrder(data)
    .map((disciplina) => ({
      disciplina,
      escola: schoolDistributions[disciplina] || null,
      rede: networkDistributions[disciplina] || data.distribuicao || null,
      ...resolveDisciplineTheme(disciplina),
    }))
    .filter((row) => row.escola || row.rede);
}

function getDisciplineOrder(data) {
  const ordered = [];
  const seen = new Set();
  const pushDiscipline = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    ordered.push(normalized);
  };

  (data.resultadosPorAno || []).forEach((row) => pushDiscipline(row.disciplina));
  Object.keys(data.distribuicaoPorDisciplina || {}).forEach(pushDiscipline);
  Object.keys(data.redeDistribuicaoPorDisciplina || {}).forEach(pushDiscipline);
  return ordered;
}

function resolveDisciplineTheme(disciplina) {
  const normalized = normalizeDisciplineName(disciplina);
  if (normalized.includes('matemat')) {
    return {
      badgeClassName: 'discipline-matematica',
      accent: '#E89C23',
      bubbleAccent: '#00A39E',
      label: 'Matemática',
    };
  }

  return {
    badgeClassName: 'discipline-linguagens',
    accent: '#6B4DA7',
    bubbleAccent: '#00A39E',
    label: disciplina || 'Disciplina',
  };
}

function renderReferenceDisciplineModule(row, theme, networkLabel = 'SME') {
  return `
    <article class="reference-area-card">
      <div class="reference-area-card-head">
        <div class="reference-area-icon ${row.badgeClassName}">
          ${renderDisciplineBadgeIcon(row.disciplina)}
        </div>
        <div class="reference-area-chip">${escapeHtml((row.label || row.disciplina || '').toUpperCase())}</div>
      </div>
      ${renderReferenceDistributionRow('Escola', row.escola, theme)}
      ${renderReferenceDistributionRow(networkLabel, row.rede, theme)}
    </article>
  `;
}

function renderReferenceDistributionRow(label, distribuicao, theme) {
  const ticks = Array.from({ length: 11 }, (_, index) => `<span>${index * 10}</span>`).join('');
  const percentuais = ((distribuicao || {}).percentuais) || {};
  const levels = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
  const stats = levels.map((level) => `
    <span class="reference-distribution-stat">
      <span class="reference-distribution-dot" style="background:${escapeHtml(resolveLevelColor(level, theme))}"></span>
      <strong>${escapeHtml(formatLocalizedPercent(percentuais[level] || 0, 2))}</strong>
    </span>
  `).join('');

  return `
    <div class="reference-distribution-block">
      <div class="reference-distribution-label">${escapeHtml(label)}</div>
      <div class="reference-distribution-body">
        <div class="reference-distribution-axis">${ticks}</div>
        ${renderReferenceDistributionTrack(distribuicao, theme)}
        <div class="reference-distribution-stats">${stats}</div>
      </div>
    </div>
  `;
}

function renderReferenceDistributionTrack(distribuicao, theme) {
  const percentuais = ((distribuicao || {}).percentuais) || {};
  const levels = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
  const segments = levels.map((level) => {
    const percentual = Math.max(Number(percentuais[level] || 0), 0.01);
    return `
      <span
        class="reference-distribution-segment"
        style="flex:${percentual} 1 0;background:${escapeHtml(resolveLevelColor(level, theme))}"
      ></span>
    `;
  }).join('');

  return `<div class="reference-distribution-track">${segments}</div>`;
}

function renderReferenceLegendItem(label, level, theme) {
  return `
    <span class="reference-legend-item">
      <span class="reference-distribution-dot" style="background:${escapeHtml(resolveLevelColor(level, theme))}"></span>
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

function renderSchoolStatBubble(highlight) {
  return `
    <article class="school-stat-bubble">
      <div class="school-stat-icon ${highlight.badgeClassName}">
        ${renderDisciplineBadgeIcon(highlight.disciplina)}
      </div>
      <div class="school-stat-value" style="color:${escapeHtml(highlight.bubbleAccent)}">
        ${escapeHtml(formatLocalizedPercent(highlight.percentual, 2))}
      </div>
      <p class="school-stat-copy">
        dos alunos apresentaram níveis proficientes e avançados em ${escapeHtml(highlight.disciplina)}.
      </p>
    </article>
  `;
}

function resolveSchoolMascotAsset(data) {
  if (data.schoolMascotAsset) {
    return data.schoolMascotAsset;
  }

  return null;
}

function renderDisciplineBadgeIcon(disciplina) {
  const normalized = normalizeDisciplineName(disciplina);
  if (normalized.includes('matemat')) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="3"></rect>
        <path d="M8 9h8M8 13h8M10 7v10M14 7v10"></path>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h10v12H7z"></path>
      <path d="M9 9h6M9 12h6M9 15h4"></path>
    </svg>
  `;
}

function renderCoverGearSvg(className) {
  return `
    <svg class="${escapeHtml(className || '')}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <g fill="#F3F2F1">
        ${Array.from({ length: 8 }, (_, index) => `
          <rect x="54" y="4" width="12" height="25" rx="4" transform="rotate(${index * 45} 60 60)"></rect>
        `).join('')}
        <circle cx="60" cy="60" r="42"></circle>
      </g>
      <circle cx="60" cy="60" r="26" fill="#0A4A69"></circle>
      <circle cx="60" cy="60" r="18" fill="#083B59"></circle>
    </svg>
  `;
}

function renderMunicipalBrandLockup(city) {
  return `
    <div class="brand-lockup">
      <span class="brand-lockup-shield" aria-hidden="true"></span>
      <span class="brand-lockup-copy">
        <span>Prefeitura de</span>
        <strong>${escapeHtml(city || 'Canoas')}</strong>
      </span>
    </div>
  `;
}

function renderEducacrossWordmark() {
  return `
    <div class="educacross-lockup">
      <span class="educacross-mark" aria-hidden="true">◉</span>
      <span class="educacross-copy"><strong>educa</strong>cross</span>
    </div>
  `;
}

function renderDisciplineSummaryPanel(mediasPorDisciplina, options = {}) {
  const rows = Object.entries(mediasPorDisciplina || {}).map(([disciplina, valores]) => [
    escapeHtml(disciplina),
    escapeHtml(formatMaybeNumber(valores.media)),
    escapeHtml(formatMaybePercent(valores.participacao)),
  ]);

  if (rows.length === 0) {
    return '';
  }

  return renderTablePanel(
    'Leitura por disciplina',
    ['Disciplina', 'Média', 'Participação'],
    rows,
    {
      panelClassName: options.panelClassName || 'panel',
      tableClassName: options.tableClassName || 'summary-table',
    },
  );
}

function renderHabilidadesTablePanel(component, pageIndex, options = {}) {
  const rows = (component.pages[pageIndex] || component.pages[0] || [])
    .map((row) => `
      <tr>
        <td class="skill-code">${escapeHtml(row.codigo != null ? String(row.codigo) : '—')}</td>
        <td>${escapeHtml(row.descricao != null ? String(row.descricao) : '—')}</td>
        <td>${renderSkillScorePill(row.percentualAcerto, row._rowColor)}</td>
      </tr>
    `)
    .join('');

  return `
    <section class="${escapeHtml(options.panelClassName || 'panel')}">
      <h2 class="panel-title">${escapeHtml(component.title || 'Resultados por Habilidade')}</h2>
      <table class="${escapeHtml(options.tableClassName || 'skills-table')}">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descrição</th>
            <th>% Acerto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderSkillScorePill(value, tone) {
  if (value == null || !Number.isFinite(Number(value))) {
    return '—';
  }

  const label = `${Number(value)}%`;
  if (!tone) {
    return escapeHtml(label);
  }

  return `<span class="skill-score-pill" style="background:${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function buildChapterLabel(chapterIndex, chapterKey) {
  const numeric = Number(chapterIndex);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `Capítulo ${String(numeric).padStart(2, '0')}`;
  }

  const fallback = String(chapterKey || '')
    .replace(/_/g, ' ')
    .trim();
  return fallback ? `Capítulo — ${fallback}` : 'Capítulo';
}

function findChart(charts, type) {
  return (charts || []).find((chart) => chart.type === type) || null;
}

function formatMaybeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return String(numeric);
}

function formatMaybePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return `${numeric}%`;
}

function formatLocalizedNumber(value, maximumFractionDigits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return numeric.toLocaleString('pt-BR', {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : Math.min(1, maximumFractionDigits),
    maximumFractionDigits,
  });
}

function formatLocalizedInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return Math.round(numeric).toLocaleString('pt-BR');
}

function formatLocalizedPercent(value, maximumFractionDigits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return `${numeric.toLocaleString('pt-BR', {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : Math.min(1, maximumFractionDigits),
    maximumFractionDigits,
  })}%`;
}

function formatCoverEditionCode(data) {
  const ano = String(data.ano || '').trim();
  const ciclo = String(data.ciclo || '').trim();
  const semestreMatch = ciclo.match(/sem(?:estre)?\s*([12])/i);
  const edition = semestreMatch ? `${ano}.${semestreMatch[1]}` : [ano, ciclo].filter(Boolean).join('.');
  return `RELATÓRIO ${edition || 'INSTITUCIONAL'}`;
}

function normalizeDisciplineName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function resolveLevelColor(level, theme, fallbackColor) {
  const proficiency = ((theme || {}).colors || DEFAULT_THEME.colors).proficiency || DEFAULT_THEME.colors.proficiency;
  return proficiency[level] || fallbackColor || DEFAULT_THEME.colors.primary;
}

function formatLevelLabel(level) {
  switch (level) {
    case 'abaixo_do_basico':
      return 'Abaixo do Básico';
    case 'basico':
      return 'Básico';
    case 'adequado':
      return 'Adequado';
    case 'avancado':
      return 'Avançado';
    default:
      return level || 'Nível';
  }
}

function renderTextPanel(title, text) {
  return `
    <section class="panel">
      <h2 class="panel-title">${escapeHtml(title || '')}</h2>
      <p class="text-block">${escapeHtml(text || '')}</p>
    </section>
  `;
}

function renderBulletPanel(title, items) {
  return `
    <section class="panel">
      <h2 class="panel-title">${escapeHtml(title || '')}</h2>
      <ul class="bullet-list">
        ${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </section>
  `;
}

function renderTablePanel(title, headers, rows, options = {}) {
  const rowsHtml = (rows || [])
    .map((row) => `<tr>${row.map((cell) => renderCell(cell)).join('')}</tr>`)
    .join('');

  return `
    <section class="${escapeHtml(options.panelClassName || 'panel')}">
      <h2 class="panel-title">${escapeHtml(title || '')}</h2>
      <table class="${escapeHtml(options.tableClassName || 'data-table')}">
        <thead>
          <tr>
            ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </section>
  `;
}

function renderCell(cell) {
  if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
    const text = cell.text != null ? cell.text : '';
    const className = cell.className ? ` class="${cell.className}"` : '';
    const style = cell.style ? ` style="${cell.style}"` : '';
    return `<td${className}${style}>${text}</td>`;
  }

  return `<td>${cell != null ? cell : ''}</td>`;
}

function buildMetodologiaText(data) {
  return `A avaliação foi realizada no município de ${data.municipio} (${data.ano}, ciclo ${data.ciclo}), abrangendo ${data.totalAlunos} estudantes nas disciplinas: ${(data.disciplinas || []).join(', ')}.`;
}

function getDeltaClass(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return 'delta-neutral';
  return numeric > 0 ? 'delta-positive' : 'delta-negative';
}

function formatDeltaValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function createAssetResolver(htmlOutputPath) {
  if (!htmlOutputPath) {
    return null;
  }

  const baseDir = path.dirname(path.resolve(htmlOutputPath));

  return (asset) => {
    if (!asset || !path.isAbsolute(asset)) {
      return asset;
    }

    const relativePath = path.relative(baseDir, asset).split(path.sep).join('/');
    return encodeURI(relativePath);
  };
}

function toAssetSrc(asset, assetResolver) {
  if (!asset) return '';
  if (/^https?:\/\//i.test(asset) || /^file:\/\//i.test(asset)) return asset;
  if (typeof assetResolver === 'function') {
    return assetResolver(asset);
  }
  return pathToFileURL(asset).href;
}

function buildLayoutClassNames(layout) {
  const classNames = [];

  if (layout.templateId) classNames.push(`layout-template-${toCssIdentifier(layout.templateId)}`);
  if (layout.variant) classNames.push(`layout-variant-${toCssIdentifier(layout.variant)}`);
  if (layout.shellRef) classNames.push(`layout-shell-${toCssIdentifier(layout.shellRef)}`);
  if (layout.styleRef) classNames.push(`layout-style-${toCssIdentifier(layout.styleRef)}`);
  if (layout.layoutSource) classNames.push(`layout-source-${toCssIdentifier(layout.layoutSource)}`);
  if (layout.frameId) classNames.push(`layout-frame-${toCssIdentifier(layout.frameId)}`);
  if (layout.chromeMode) classNames.push(`layout-chrome-${toCssIdentifier(layout.chromeMode)}`);
  if (layout.sectionGroup) classNames.push(`layout-group-${toCssIdentifier(layout.sectionGroup)}`);
  if (layout.reviewPriority) classNames.push(`layout-priority-${toCssIdentifier(layout.reviewPriority)}`);

  return classNames;
}

function buildLayoutAttributes(layout) {
  const attributes = [];

  if (layout.templateId) attributes.push(`data-template-id="${escapeHtml(layout.templateId)}"`);
  if (layout.variant) attributes.push(`data-layout-variant="${escapeHtml(layout.variant)}"`);
  if (layout.shellRef) attributes.push(`data-shell-ref="${escapeHtml(layout.shellRef)}"`);
  if (layout.styleRef) attributes.push(`data-style-ref="${escapeHtml(layout.styleRef)}"`);
  if (layout.layoutSource) attributes.push(`data-layout-source="${escapeHtml(layout.layoutSource)}"`);
  if (layout.frameId) attributes.push(`data-frame-id="${escapeHtml(layout.frameId)}"`);
  if (layout.chromeMode) attributes.push(`data-chrome-mode="${escapeHtml(layout.chromeMode)}"`);
  if (layout.sectionGroup) attributes.push(`data-section-group="${escapeHtml(layout.sectionGroup)}"`);
  if (layout.reviewPriority) attributes.push(`data-review-priority="${escapeHtml(layout.reviewPriority)}"`);

  return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
}

function resolveLayoutShell(page, fallback = '') {
  const layout = (page && page.layout) || {};
  return layout.shellRef || fallback || '';
}

function toCssIdentifier(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeClassToken(value) {
  return toCssIdentifier(
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  );
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  buildHtmlDocument,
  buildDocumentStyles,
  buildBodyAttributes,
  escapeHtml,
};
