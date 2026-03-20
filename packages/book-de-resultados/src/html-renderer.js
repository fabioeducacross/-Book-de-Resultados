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
  const s = theme.spacing || DEFAULT_THEME.spacing || {};
  const br = theme.borderRadius || {};
  const bw = theme.borderWidth || {};
  const sizes = (t.sizes || {});
  const weights = (t.weights || {});
  const lineHeights = (t.lineHeights || {});
  const ls = (t.letterSpacing || {});
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
  // Extended color tokens (Figma editorial grays)
  const textEditorial = c.textEditorial || '#5D6A73';
  const textEditorialMuted = c.textEditorialMuted || '#61727D';
  const textEditorialSoft = c.textEditorialSoft || '#59656F';
  const textLabel = c.textLabel || '#516874';
  const textNote = c.textNote || '#7A858D';
  const textKpiNote = c.textKpiNote || '#8A9197';
  const textReference = c.textReference || '#6F7881';
  const textReferenceSubtle = c.textReferenceSubtle || '#7B848B';
  const textReferenceMuted = c.textReferenceMuted || '#8A9299';
  const textAxis = c.textAxis || '#A0A8AF';
  // Surface, border, track tokens
  const surfaceTintSecondary = c.surfaceTintSecondary || '#E8F5F4';
  const surfaceEditorialPanel = c.surfaceEditorialPanel || 'rgba(246,243,249,0.72)';
  const borderSeparator = c.borderSeparator || '#E1E5E2';
  const borderGridRule = c.borderGridRule || '#DDD8CF';
  const borderRibbon = c.borderRibbon || '#A6C9C4';
  const borderFrameBadge = c.borderFrameBadge || '#8A9299';
  const trackBg = c.trackBackground || '#E8ECEB';
  const trackBgMedia = c.trackBackgroundMedia || '#EDF1EF';
  const pillNetwork = c.pillNetwork || 'rgba(31,167,217,0.1)';
  const pillSchool = c.pillSchool || 'rgba(78,195,140,0.12)';
  // Typography size tokens (pt)
  const szEyebrow = sizes.eyebrow || 7.8;
  const szHeaderSubtitle = sizes.headerSubtitle || 8.2;
  const szHeaderMeta = sizes.headerMeta || 8.1;
  const szSectionKicker = sizes.sectionKicker || 7.2;
  const szSchoolName = sizes.schoolName || 18;
  const szKpiValue = sizes.kpiValue || 22;
  const szKpiLabel = sizes.kpiLabel || 6.8;
  const szKpiNote = sizes.kpiNote || 6.9;
  const szParticipationNumber = sizes.participationNumber || 40;
  const szParticipationLabel = sizes.participationLabel || 7.5;
  const szEditorialTitle = sizes.editorialTitle || 10.6;
  const szEditorialPoint = sizes.editorialPoint || 8;
  const szRefHeading = sizes.referenceHeading || 14.5;
  const szRefHeadingPrint = sizes.referenceHeadingPrint || 13;
  const szRefSubheading = sizes.referenceSubheading || 9;
  const szRefSubheadingPrint = sizes.referenceSubheadingPrint || 10;
  const szRefLabel = sizes.referenceLabel || 10.8;
  const szRefLabelBase = sizes.referenceLabelBase || 12;
  const szRefChip = sizes.referenceChip || 7.4;
  const szRefChipBase = sizes.referenceChipBase || 8.8;
  const szRefAxis = sizes.referenceAxis || 6.1;
  const szRefAxisBase = sizes.referenceAxisBase || 6.6;
  const szRefStat = sizes.referenceStat || 8;
  const szRefStatMedia = sizes.referenceStatMedia || 7.4;
  const szChromeBadge = sizes.chromeBadge || 8.5;
  const szChromeLabel = sizes.chromeLabel || 7.6;
  const szRefDotPrint = sizes.referenceDotPrint || 4.8;
  // Weight tokens
  const wRegular = weights.regular || 400;
  const wMedium = weights.medium || 600;
  const wBold = weights.bold || 700;
  const wExtrabold = weights.extrabold || 800;
  const wBlack = weights.black || 900;
  // Border radius tokens
  const brXs = br.xs || '0.6mm';
  const brSm = br.sm || '1.2mm';
  const brMd = br.md || '1.6mm';
  const brLg = br.lg || '1.8mm';
  const brXl = br.xl || '2mm';
  const brXxl = br.xxl || '6mm';
  const brPill = br.pill || '999px';
  // Border width tokens
  const bwHairline = bw.hairline || '0.35mm';
  const bwThin = bw.thin || '0.4mm';
  const bwRegular = bw.regular || '1px';
  const bwMedium = bw.medium || '1.4px';
  const bwThick = bw.thick || '2px';

  return `
    @page {
      size: 250mm 210mm;
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
      width: 250mm;
      min-height: 210mm;
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
      min-height: 210mm;
      display: grid;
      grid-template-rows: 62mm 1.8mm 1fr;
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
      min-height: 82mm;
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
      max-height: 68mm;
      object-fit: contain;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    .chapter-hero {
      min-height: 210mm;
      padding: 16mm 18mm;
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
      padding: 3.9mm 3.4mm 3mm;
      border-radius: 2.4mm;
      border-color: #D2DAD7;
      background: rgba(247, 248, 246, 0.98);
    }

    .section-visao_geral .indicator-card::before,
    .section-resultados_disciplina .indicator-card::before {
      height: 0.7mm;
      background: ${brandStrong};
    }

    .section-resultados_disciplina .indicator-card::before {
      background: linear-gradient(90deg, ${c.brandPurple || brandStrong}, ${accentColor});
    }

    .section-visao_geral .indicator-card .value,
    .section-resultados_disciplina .indicator-card .value {
      font-size: 15.4pt;
      line-height: 0.96;
      letter-spacing: -0.01em;
      min-height: 5.2mm;
    }

    .section-visao_geral .indicator-card .label,
    .section-resultados_disciplina .indicator-card .label {
      font-size: 7.3pt;
      letter-spacing: 0.01em;
      text-transform: none;
      line-height: 1.18;
      color: #587082;
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
      border-color: rgba(19, 61, 89, 0.12);
      background:
        radial-gradient(circle at 12% 18%, rgba(255, 196, 73, 0.14) 0%, rgba(255, 196, 73, 0) 24%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 248, 247, 0.98) 100%);
      box-shadow: 0 1.6mm 4mm rgba(8, 41, 63, 0.08);
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-overview::before {
      height: 1.2mm;
      background: linear-gradient(90deg, ${accentColor}, #FFD36A 52%, rgba(255, 255, 255, 0.8) 100%);
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-kicker,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-title,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-copy,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-overview .page-subtitle,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-footnote {
      color: #16384F;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-kicker {
      color: #8D5E00;
      letter-spacing: 0.08em;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-copy,
    .layout-style-analytic-overview.section-visao_geral .hero-panel-overview .page-subtitle {
      color: rgba(22, 56, 79, 0.8);
    }

    .layout-style-analytic-overview.section-visao_geral .hero-kpi-chip {
      border-color: rgba(19, 61, 89, 0.12);
      background: rgba(255, 255, 255, 0.9);
      color: #35586F;
      box-shadow: none;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-kpi-chip strong {
      color: #0F3349;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-emphasis {
      background: linear-gradient(180deg, rgba(255, 251, 241, 1) 0%, rgba(250, 245, 230, 0.98) 100%);
      border-color: rgba(214, 169, 72, 0.42);
      box-shadow: 0 1.4mm 3.4mm rgba(4, 25, 40, 0.08);
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-emphasis-label {
      color: #8D5E00;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-emphasis-value {
      font-size: 18pt;
      color: #0F3349;
    }

    .layout-style-analytic-overview.section-visao_geral .hero-panel-emphasis-note {
      color: ${c.textSecondary};
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-band {
      border-top-color: rgba(19, 61, 89, 0.12);
      border-bottom-color: rgba(19, 61, 89, 0.12);
      background: linear-gradient(180deg, rgba(248, 251, 250, 1) 0%, rgba(242, 247, 246, 1) 100%);
      box-shadow: none;
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-card + .priority-context-card {
      border-left-color: rgba(19, 61, 89, 0.1);
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-label {
      color: rgba(53, 88, 111, 0.76);
    }

    .layout-style-analytic-overview.section-visao_geral .priority-context-value {
      color: #16384F;
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
    .layout-style-analytic-overview.section-visao_geral .indicator-card-total-estudantes,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-participacao-media,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-media-geral {
      background: rgba(246, 247, 244, 0.98);
      border-color: rgba(19, 61, 89, 0.12);
      box-shadow: none;
      transform: none;
    }

    .layout-style-analytic-overview.section-visao_geral .indicator-card-total-escolas::before,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-total-estudantes::before,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-participacao-media::before,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-media-geral::before {
      height: 0.7mm;
      background: #2D5A73;
    }

    .layout-style-analytic-overview.section-visao_geral .indicator-card-total-escolas .value,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-total-estudantes .value,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-participacao-media .value,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-media-geral .value {
      font-size: 16.2pt;
      color: #0F3349;
    }

    .layout-style-analytic-overview.section-visao_geral .indicator-card-total-escolas .label,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-total-estudantes .label,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-participacao-media .label,
    .layout-style-analytic-overview.section-visao_geral .indicator-card-media-geral .label {
      color: #5C7383;
    }

    .layout-style-analytic-overview.section-visao_geral .page-footer {
      border: 0;
      border-top: 0.35mm solid rgba(19, 61, 89, 0.16);
      background: transparent;
      border-radius: 0;
      padding: 1.8mm 0 0;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 2mm;
      color: rgba(53, 88, 111, 0.9);
      font-size: 8.5pt;
    }

    .layout-style-analytic-overview.section-visao_geral .page-footer-center {
      display: none;
    }

    .layout-style-analytic-overview.section-visao_geral .page-footer-right {
      color: #0F3349;
      font-family: ${displayFontStack};
      font-size: 10.5pt;
      font-weight: 700;
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
      padding-top: 4.4mm;
      padding-bottom: 7.8mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-panel {
      display: flex;
      flex-direction: column;
      gap: 2.4mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-copy {
      margin: 0;
      color: rgba(53, 88, 111, 0.88);
      font-size: 9.3pt;
      line-height: 1.45;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-panel .reference-distribution-block {
      grid-template-columns: 14mm minmax(0, 1fr);
      gap: 2.6mm;
      align-items: flex-start;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-panel .reference-distribution-label {
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-panel .reference-distribution-body {
      gap: 1.6mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-panel .reference-distribution-track {
      min-height: 12.4mm;
      border-radius: 1.4mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-panel .reference-distribution-axis {
      font-size: 6.1pt;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-panel .reference-distribution-stats {
      gap: 1.2mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-highlights {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-highlight {
      border: 1px solid rgba(19, 61, 89, 0.12);
      border-radius: 3mm;
      background: rgba(248, 251, 250, 0.96);
      padding: 2.2mm 2.4mm;
      display: flex;
      flex-direction: column;
      gap: 0.6mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-highlight-label {
      color: rgba(53, 88, 111, 0.82);
      font-size: 7.8pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-highlight-value {
      color: #0F3349;
      font-size: 13.4pt;
      line-height: 1;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-reference-legend {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.2mm 2mm;
    }

    .layout-style-analytic-overview.section-visao_geral .panel-overview-proficiencia,
    .layout-style-analytic-overview.section-visao_geral .panel-overview-discipline-summary {
      background: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(247, 249, 248, 0.98) 100%);
    }

    .layout-style-analytic-overview.section-visao_geral .panel-overview-summary {
      background: linear-gradient(180deg, rgba(240, 236, 246, 0.92) 0%, rgba(245, 242, 248, 0.9) 100%);
      border-color: rgba(116, 102, 145, 0.16);
      box-shadow: none;
      padding: 2.2mm 3mm;
    }

    .layout-style-analytic-overview.section-visao_geral .panel-overview-summary .panel-title {
      color: #FFFFFF;
      margin-bottom: 0.8mm;
      font-size: 10.8pt;
    }

    .layout-style-analytic-overview.section-visao_geral .summary-callout-overview {
      border-left-width: 0;
      border-top: 0.35mm solid rgba(116, 102, 145, 0.22);
      background: transparent;
      box-shadow: none;
      display: flex;
      flex-direction: column;
      gap: 0;
      min-height: 0;
      padding: 1.4mm 0 0.2mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-summary-lead,
    .layout-style-analytic-overview.section-visao_geral .overview-summary-points p {
      margin: 0;
      color: #4D4D67;
      font-size: 8.25pt;
      line-height: 1.3;
      font-weight: 500;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-summary-stat-strip {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.8mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-summary-stat {
      border-radius: 2.8mm;
      background: rgba(248, 251, 250, 0.94);
      border: 1px solid rgba(19, 61, 89, 0.1);
      padding: 2mm 2.2mm;
      display: flex;
      flex-direction: column;
      gap: 0.6mm;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-summary-stat-label {
      color: rgba(53, 88, 111, 0.82);
      font-size: 7.7pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-summary-stat-value {
      color: #0F3349;
      font-size: 13.2pt;
      line-height: 1;
    }

    .layout-style-analytic-overview.section-visao_geral .overview-summary-points {
      display: flex;
      flex-direction: column;
      gap: 1.6mm;
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
      border-radius: ${brXxl};
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
      background: ${pillNetwork};
    }

    .score-pill-school {
      background: ${pillSchool};
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
      gap: 4mm;
      padding-top: 0;
    }

    .section-escola_disciplinas .reference-school-area-title {
      padding: 0 4.2mm;
    }

    .section-escola_disciplinas .reference-school-area-heading {
      font-size: ${szRefHeading}pt;
      font-weight: 700;
      color: ${brandStrong};
      line-height: 1.15;
      margin: 0 0 1mm;
    }

    .section-escola_disciplinas .reference-school-area-subheading {
      font-size: ${szRefSubheading}pt;
      color: ${textReference};
      margin: 0;
      line-height: 1.3;
    }

    .section-escola_disciplinas .reference-school-area-subheading-accent {
      color: ${brandSecondary};
      font-weight: 700;
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
      border-bottom: ${bwRegular} solid ${borderSeparator};
    }

    .section-escola_disciplinas .reference-area-icon {
      width: 8.4mm;
      height: 8.4mm;
      border-radius: ${brMd};
    }

    .section-escola_disciplinas .reference-area-icon.discipline-matematica {
      background: ${c.brandGreen};
    }

    .section-escola_disciplinas .reference-area-icon.discipline-linguagens {
      background: ${c.brandOrange};
    }

    .section-escola_disciplinas .reference-area-chip {
      padding: 1.1mm 3.2mm;
      border-radius: ${brXl};
      font-size: ${szRefChip}pt;
      letter-spacing: 0.08em;
    }

    .section-escola_disciplinas .reference-area-chip.discipline-matematica {
      background: ${c.brandGreen};
    }

    .section-escola_disciplinas .reference-area-chip.discipline-linguagens {
      background: ${c.brandOrange};
    }

    .section-escola_disciplinas .reference-distribution-block {
      grid-template-columns: 16mm minmax(0, 1fr);
      gap: 2.2mm;
      align-items: start;
    }

    .section-escola_disciplinas .reference-distribution-label {
      padding-top: 1.2mm;
      font-size: ${szRefLabel}pt;
      line-height: 1.04;
      letter-spacing: -0.02em;
    }

    .section-escola_disciplinas .reference-distribution-body {
      gap: 1.2mm;
    }

    .section-escola_disciplinas .reference-distribution-axis {
      padding: 0 0.4mm;
      color: ${textAxis};
      font-size: ${szRefAxis}pt;
    }

    .section-escola_disciplinas .reference-distribution-track {
      min-height: 8.4mm;
      border-left-width: 1.4px;
      border-radius: ${brSm};
      background: ${trackBgMedia};
    }

    .section-escola_disciplinas .reference-distribution-track::before {
      left: -2.6mm;
      width: 2.6mm;
      height: 0.8mm;
    }

    .section-escola_disciplinas .reference-distribution-stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.6mm;
      padding-top: 0.4mm;
    }

    .section-escola_disciplinas .reference-distribution-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 0.8mm;
      color: ${textReference};
      font-size: ${szRefStatMedia}pt;
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
      padding: 10mm 30mm 5mm 20mm;
      max-height: 210mm;
      overflow: hidden;
      background: linear-gradient(180deg, #FBFBF8 0%, #F4F3EE 100%);
      gap: 4.8mm;
    }

    .page::before {
      inset: auto 0 0 0;
      height: 4.8mm;
      border: none;
      border-radius: 0;
      background: ${c.secondary};
    }

    /* ── Purple bar for editorial / overview / math sections ── */
    .section-visao_geral::before,
    .section-participacao_rede::before,
    .section-participacao_rede_tabela::before,
    .section-contexto_avaliacao::before,
    .section-metodologia::before,
    .section-apresentacao::before,
    .section-sumario::before,
    .layout-variant-discipline-matematica::before {
      background: ${c.brandPurple || '#7D6BC2'};
    }

    .page::after {
      display: none;
    }

    /* ── Reset cover/chapter padding after Canoas override ── */
    .page.cover-page,
    .page.chapter-page {
      padding: 0;
      gap: 0;
      max-height: 210mm;
    }

    .page.cover-page::before,
    .page.cover-page::after,
    .page.chapter-page::before,
    .page.chapter-page::after {
      display: none;
    }

    /* ── Chrome bars for framed pages ── */
    .layout-chrome-framed:not(.section-escola) {
      padding: 0;
    }

    .framed-chrome-header {
      display: none;
    }

    .layout-chrome-framed:not(.section-escola) .page-content-framed {
      padding: 4mm 16mm;
    }

    .framed-chrome-footer {
      display: none;
    }

    .framed-chrome-page-number {
      border: ${bwThin} solid ${borderFrameBadge};
      padding: 0.5mm 2mm;
      font-size: 7pt;
      line-height: 1;
    }

    .page-header {
      min-height: 14mm;
      align-items: start;
    }

    .page-header::after {
      display: none;
    }

    .page-heading {
      gap: 0.3mm;
      padding-right: 0;
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
      min-height: 210mm;
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
      padding: 20mm 18mm 12mm;
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
      min-height: 210mm;
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
      padding: 18mm 20mm 14mm;
      min-height: 210mm;
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
      padding: 14mm 20mm 12mm;
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

    .section-escola {
      padding: 0;
    }

    .section-escola .school-summary-aside {
      padding-left: 20mm;
    }

    .section-escola .school-summary-main {
      padding-right: 14mm;
    }

    /* ── escola_disciplinas: clone Figma node 7463:2 ── */
    .layout-chrome-framed.section-escola_disciplinas {
      position: relative;
    }

    .layout-chrome-framed.section-escola_disciplinas::before,
    .layout-chrome-framed.section-escola_disciplinas::after {
      content: '';
      display: block;
      position: absolute;
      left: 0;
      right: 0;
      height: 3.6mm;
      background: ${brandSecondary};
      z-index: 10;
    }

    .layout-chrome-framed.section-escola_disciplinas::before {
      top: 0;
      border-radius: ${brXl} ${brXl} 0 0;
    }

    .layout-chrome-framed.section-escola_disciplinas::after {
      bottom: 0;
      border-radius: 0 0 ${brXl} ${brXl};
    }

    .layout-chrome-framed.section-escola_disciplinas .page-content-framed {
      padding: 14mm 16mm 19.2mm 14mm;
    }

    .section-escola_disciplinas .framed-chrome-header {
      display: flex;
      justify-content: flex-end;
      padding: 8mm 16mm 0;
      min-height: 0;
      height: auto;
      border: none;
      background: none;
    }

    .section-escola_disciplinas .framed-chrome-header span:first-child {
      display: none;
    }

    .section-escola_disciplinas .framed-chrome-header span:last-child {
      color: ${c.textMuted};
      font-size: ${szChromeLabel}pt;
      font-weight: 400;
      letter-spacing: 0;
    }

    .section-escola_disciplinas .framed-chrome-footer {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      position: absolute;
      top: 191mm;
      left: 0;
      right: 0;
      padding: 0 16mm;
      min-height: 0;
      height: auto;
      border: none;
      background: none;
    }

    .section-escola_disciplinas .framed-chrome-footer .framed-chrome-page-number {
      font-size: ${szChromeBadge}pt;
      font-weight: 700;
      color: ${c.textMuted};
    }

    .section-escola_disciplinas .framed-chrome-footer .framed-chrome-footer-label {
      position: absolute;
      right: 16mm;
      top: 0;
      color: ${c.textMuted};
      font-size: ${szChromeLabel}pt;
      font-weight: 700;
    }

    .section-escola_disciplinas .reference-school-area {
      flex: 1;
      min-height: 0;
      gap: 0;
    }

    .section-escola_disciplinas .reference-school-area-title {
      margin-bottom: 12mm;
    }

    .section-escola_disciplinas .reference-school-area-heading {
      font-size: ${szRefHeadingPrint}pt;
      font-weight: ${wExtrabold};
      color: ${c.textPrimary};
    }

    .section-escola_disciplinas .reference-school-area-subheading {
      font-size: ${szRefSubheadingPrint}pt;
      color: ${brandSecondary};
    }

    .section-escola_disciplinas .reference-school-area-subheading-accent {
      color: ${brandSecondary};
    }

    .section-escola_disciplinas .reference-school-area-grid {
      align-items: start;
    }

    .section-escola_disciplinas .reference-area-card {
      gap: 3mm;
    }

    .section-escola_disciplinas .reference-area-legend {
      margin-top: auto;
      padding-top: 2.5mm;
      padding-bottom: 2.8mm;
    }

    .section-escola_disciplinas .reference-distribution-track {
      min-height: 10mm;
      border-left-width: 0;
      border-radius: 0.6mm;
      background: transparent;
    }

    .section-escola_disciplinas .reference-distribution-track::before {
      left: -4mm;
      width: 2mm;
      height: 2mm;
      border-radius: 50%;
      background: ${brandStrong};
    }

    .section-escola_disciplinas .reference-distribution-track::after {
      content: '';
      position: absolute;
      left: -2mm;
      top: 50%;
      width: 2mm;
      height: 0.8mm;
      background: ${brandStrong};
      transform: translateY(-50%);
    }

    .section-escola_disciplinas .reference-distribution-dot {
      width: 7.5mm;
      height: 7.5mm;
      box-shadow: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-size: 4.8pt;
      font-weight: 800;
      line-height: 1;
    }

    .section-escola_disciplinas .reference-distribution-stats {
      gap: 1.2mm;
      padding-top: 1.5mm;
    }

    .section-escola_disciplinas .reference-distribution-stat {
      font-size: 8pt;
    }

    .section-escola_disciplinas .reference-distribution-stat strong {
      color: inherit;
    }

    .section-escola_disciplinas .reference-area-legend .reference-distribution-dot {
      width: 3.9mm;
      height: 3.9mm;
      font-size: 0;
    }

    .analytic-split[data-layout="school-summary-shell"] {
      grid-template-columns: 1fr 1fr;
      gap: 0;
      flex: 1;
      min-height: 0;
      align-items: stretch;
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
      height: 1.4mm;
      background: ${c.secondary};
    }

    .analytic-split[data-layout="school-summary-shell"] > * {
      gap: 0;
    }

    .school-summary-aside {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 8mm 6mm 8mm 8mm;
      background: ${c.background};
    }

    .school-brand-block {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.6mm;
      margin-bottom: 3.2mm;
    }

    .school-editorial-header {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
      margin-bottom: 2.6mm;
    }

    .school-brand-eyebrow {
      color: ${brandStrong};
      font-size: ${szEyebrow}pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .school-header-subtitle {
      margin: 0;
      color: ${c.textPrimary};
      font-size: ${szHeaderSubtitle}pt;
      font-weight: ${wMedium};
      line-height: 1.35;
    }

    .school-header-meta {
      margin: 0;
      color: ${c.textSecondary};
      font-size: ${szHeaderMeta}pt;
      font-weight: ${wMedium};
      line-height: 1.35;
    }

    .school-section-kicker {
      margin: 0 0 1.6mm;
      color: ${textEditorialMuted};
      font-size: ${szSectionKicker}pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .school-brand-partnership {
      width: 100%;
      display: none;
    }

    .school-hero-figure {
      position: relative;
      width: 100%;
      min-height: 28mm;
      margin-bottom: 1.2mm;
    }

    .school-hero-figure[hidden] {
      display: none;
    }

    .school-hero-figure::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 1.2mm;
      height: 1.2mm;
      background-image:
        radial-gradient(circle, rgba(15, 74, 107, 0.55) 44%, transparent 46%),
        radial-gradient(circle, rgba(15, 74, 107, 0.55) 44%, transparent 46%),
        linear-gradient(to right, rgba(15, 74, 107, 0.38), rgba(15, 74, 107, 0.38));
      background-size: 1.2mm 1.2mm, 1.2mm 1.2mm, 100% 0.28mm;
      background-position: left center, right center, center;
      background-repeat: no-repeat, no-repeat, no-repeat;
    }

    .school-hero-figure::before {
      content: none;
    }

    .school-owl-wrap {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
      width: 100%;
      min-height: 100%;
    }

    .school-owl-wrap .school-owl-image {
      position: relative;
      top: 1px;
      height: 26mm;
      width: auto;
      display: block;
      flex-shrink: 0;
    }

    .school-summary-main {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: stretch;
      gap: 3.2mm;
      padding: 11mm 10mm 14mm 10mm;
      background: #FFFFFF;
      border-left: ${bwHairline} solid rgba(19, 61, 89, 0.08);
    }

    .school-summary-main-copy {
      width: 100%;
      display: flex;
      justify-content: flex-start;
    }

    .school-summary-main-metrics {
      width: 100%;
      display: flex;
      justify-content: flex-end;
      margin-top: auto;
    }

    .school-summary-copy {
      margin: 0;
      color: ${textEditorial};
      font-size: ${szEditorialPoint}pt;
      font-weight: ${wRegular};
      line-height: 1.35;
      letter-spacing: 0;
    }

    .school-ranking-ribbon {
      margin-bottom: 4mm;
      padding: 1.6mm 4mm;
      border-radius: ${brPill};
      border: ${bwRegular} solid ${borderRibbon};
      background: rgba(255, 255, 255, 0.9);
      color: ${brandStrong};
      font-size: ${szHeaderSubtitle}pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .school-name-display {
      width: 100%;
      margin: 0 0 4.2mm;
      padding-top: 0;
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: ${szSchoolName}pt;
      font-weight: ${wExtrabold};
      line-height: 1.04;
      letter-spacing: -0.02em;
    }

    .school-kpi-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.6mm;
      margin-bottom: 2mm;
    }

    .school-kpi-card {
      position: relative;
      padding: 2.9mm 2.8mm 3.4mm;
      border: none;
      background: transparent;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 148.822 146.002' preserveAspectRatio='none'%3E%3Cg transform='translate(0%2C146.002) scale(1%2C-1)'%3E%3Cpath d='M142.729 145.252H6.09302C3.14202 145.252 0.75 142.855 0.75 139.899V14.9273C0.75 11.9713 3.14202 9.57426 6.09302 9.57426H28.663C29.823 9.72126 31.583 8.94725 32.596 7.84525L38.434 1.48725C39.383 0.504252 40.884 0.504252 41.787 1.48725L47.625 7.84525C48.302 8.80025 50.062 9.57426 51.557 9.57426H142.729C145.68 9.57426 148.072 11.9713 148.072 14.9273V139.899C148.073 142.855 145.68 145.252 142.729 145.252Z' fill='white' fill-opacity='0.7' stroke='none'/%3E%3C/g%3E%3C/svg%3E");
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: center center;
      text-align: left;
      box-shadow: none;
    }

    .school-kpi-card::after {
      content: none;
    }

    .school-kpi-value {
      color: ${brandStrong};
      font-family: ${displayFontStack};
      font-size: ${szKpiValue}pt;
      font-weight: ${wBlack};
      line-height: 1;
    }

    .school-kpi-label {
      margin-top: 0.8mm;
      color: ${brandStrong};
      font-size: ${szKpiLabel}pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .school-kpi-note {
      color: ${textKpiNote};
      font-size: ${szKpiNote}pt;
      line-height: 1.25;
    }

    .school-operational-table {
      margin-top: 0;
        font-size: 6.8pt;
        border: none;
        border-collapse: collapse;
        background: #FFFFFF;
    }

    .school-operational-table th {
        padding: 1.1mm 1.4mm;
        border: none;
        background: #FFFFFF;
        color: ${c.textPrimary};
        font-size: ${szKpiLabel}pt;
        font-weight: 700;
        line-height: 1.1;
    }

      .school-operational-table td {
        padding: 1.15mm 1.4mm;
        border: none;
        background: #FFFFFF;
        color: ${c.textPrimary};
        font-size: ${szKpiLabel}pt;
        line-height: 1.1;
        vertical-align: middle;
      }

      .school-operational-table thead th:first-child {
          background: ${c.secondary};
        color: transparent;
      }

      .school-operational-table thead th:last-child {
        background: ${c.secondary};
        color: #FFFFFF;
        text-align: center;
        letter-spacing: 0.05em;
      }

    .school-operational-table td:last-child,
    .school-operational-table th:last-child {
        width: 13.5mm;
        text-align: center;
    }

    .school-table-section-row th {
        padding: 1.15mm 1.4mm;
        background: ${surfaceTintSecondary};
        color: ${brandStrong};
        font-size: 6.8pt;
      font-weight: 700;
        letter-spacing: 0.05em;
        text-align: center;
      text-transform: uppercase;
    }

    .school-participation-feature {
      margin-top: auto;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.15mm;
      width: 100%;
      padding-top: 2.8mm;
      border-top: 0.35mm solid rgba(19, 61, 89, 0.14);
    }

    .school-participation-ghost-wrap {
      display: flex;
      align-items: flex-end;
      gap: 1.1mm;
    }

    .school-participation-number {
      color: transparent;
      -webkit-text-stroke: 1.5px rgba(19, 61, 89, 0.3);
      font-family: ${displayFontStack};
      font-size: ${szParticipationNumber}pt;
      font-weight: ${wBlack};
      line-height: 0.8;
      letter-spacing: -0.04em;
    }

    .school-participation-label {
      position: relative;
      left: 0;
      top: 0;
      margin-left: 0.8mm;
      color: ${textLabel};
      font-size: ${szParticipationLabel}pt;
      font-weight: 700;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }

    .school-participation-note {
      color: ${textNote};
      font-size: ${szSectionKicker}pt;
      line-height: 1.35;
    }

    .school-participation-stars {
        display: flex;
        width: 14mm;
        height: 23mm;
        position: relative;
        top: 31px;
        left: -1px;
        margin-bottom: 2mm;
        background-image: url('data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgdmlld0JveD0iMCAwIDMzLjQ3MiAzNS42Nzk2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZyBpZD0iVmVjdG9yIj4KPHBhdGggZD0iTTE4LjY0MzEgMC4wMDcxMjgyOEMxOC42MjkxIDAuMDA1MTI4MjggMTguNTg4MSAwLjAwMzEzMDQ4IDE4LjYwMjEgMC4wMDMxMzA0OEwxOC42MzAxIDAuMDA2MTIxMkMxOC4yNjAxIC0wLjAzNTg3ODggMTcuODcyMSAwLjE0MTExNCAxNy42NjIxIDAuNDQ5MTE0TDExLjgwOTEgOS4wNDAxMkwxLjQxNDEgOS4wODgxM0MwLjkzNjA5NyA5LjA5MTEzIDAuNDg4MTAzIDkuNDY4MTMgMC40MDQxMDMgOS45MzgxM0MwLjQwMzEwMyA5Ljk0NDEzIDAuNDAyMTA0IDkuOTUwMTEgMC40MDIxMDQgOS45NTcxMUwwLjAxMTA5NzYgMTIuNzM4MUwwLjAxMjEwNDcgMTIuNzI3MUMwLjAxMDEwNDcgMTIuNzQxMSAwLjAwODEwNzk1IDEyLjc1NjEgMC4wMDYxMDc5NSAxMi43NzAxTDAuMDA4MTA2ODUgMTIuNzU5MUwwLjAwNTEwMDg3IDEyLjc3ODFDLTAuMDA1ODk5MTMgMTIuODU0MSAwLjAwMTA5ODA2IDEyLjkzMTEgMC4wMjQwOTgxIDEzLjAwNTFDMC4wNDYwOTgxIDEzLjE5MTEgMC4xMDEwOTkgMTMuMzczMSAwLjIxNjA5OSAxMy41MjExTDYuMjI1MSAyMS4yODgxTDMuODAwMSAyOC44NzExVjI4Ljg3MjJDMy43NzgxIDI4Ljk0MDIgMy43NjQxMSAyOS4wMTExIDMuNzU2MTEgMjkuMDgyMUwzLjc1OTEgMjkuMDYyMUwzLjM3NjEgMzEuNzkyMUwzLjM3ODEgMzEuNzcyMUMzLjM3MzEgMzEuNzk5MSAzLjM2OTEgMzEuODI2MSAzLjM2NzEgMzEuODU0MUwzLjM3MDExIDMxLjgzNDFMMy4zNjYxMSAzMS44NjMxQzMuMzUxMTEgMzEuOTY3MSAzLjM2OTEgMzIuMDc0MSAzLjQxNzEgMzIuMTY3MUMzLjQ3MTEgMzIuNDA5MSAzLjU4MjExIDMyLjYzOTIgMy43ODIxMSAzMi43ODYyQzQuMDUzMTEgMzIuOTg1MiA0LjQyNDEgMzMuMDQwMiA0Ljc0MDEgMzIuOTI3MlYzMi45MjYxTDE0LjUyNTEgMjkuNDE3MUwyMi45NjMxIDM1LjQ4ODFDMjMuMjM2MSAzNS42ODQxIDIzLjYwODEgMzUuNzM0MiAyMy45MjMxIDM1LjYxNzJDMjQuMTU1MSAzNS41MzEyIDI0LjMyNTEgMzUuMzQxMSAyNC40NDQxIDM1LjEyNDFDMjQuNTE2MSAzNS4wNDcxIDI0LjU2MzEgMzQuOTQ5MSAyNC41NzgxIDM0Ljg0NDFMMjQuOTc1MSAzMi4wMjMyQzI0Ljk4MzEgMzEuOTY1MiAyNC45ODYxIDMxLjkwNzEgMjQuOTg0MSAzMS44NDkxTDI0Ljc0NDEgMjMuODkwMUwzMi42NjExIDE4LjA4MTFDMzIuODEyMSAxNy45NzAxIDMyLjkxNDEgMTcuODEwMSAzMi45ODYxIDE3LjYzODFDMzMuMDI5MSAxNy41NzQxIDMzLjA1NzEgMTcuNTAxMSAzMy4wNjgxIDE3LjQyNTFMMzMuMDcxMSAxNy40MDYxTDMzLjA2OTEgMTcuNDE3MUMzMy4wNzExIDE3LjQwMjEgMzMuMDczMSAxNy4zODcxIDMzLjA3NTEgMTcuMzczMUwzMy4wNzQxIDE3LjM4NDFMMzMuNDYwMSAxNC42MzUxTDMzLjQ1OTEgMTQuNjQ2MUMzMy40NjExIDE0LjYzMTEgMzMuNDYzMSAxNC42MTYxIDMzLjQ2NTEgMTQuNjAyMUMzMy40NjYxIDE0LjU5NjEgMzMuNDY2MSAxNC41OTExIDMzLjQ2NzEgMTQuNTg0MUMzMy41MTYxIDE0LjExMDEgMzMuMTg5MSAxMy42MjQxIDMyLjczMTEgMTMuNDkwMUwyMi43NTIxIDEwLjU3ODFMMTkuNDk1MSAwLjcwNzExQzE5LjM3MzEgMC4zMzkxMSAxOS4wMjgxIDAuMDU1MTI4MyAxOC42NDQxIDAuMDA3MTI4MjhIMTguNjQzMVoiIGZpbGw9IiNCNDFDMDAiLz4KPHBhdGggZD0iTTE4LjE1OTEgMy4yODMxNEMxOC4wNjUxIDMuMjcyMTQgMTcuOTcwMSAzLjI4NzExIDE3Ljg4NTEgMy4zMjcxMUMxNy43OTkxIDMuMzY2MTEgMTcuNzI2MSAzLjQyODEzIDE3LjY3MzEgMy41MDYxM0wxMS42NjgxIDEyLjMxOTFMMS4wMDMxIDEyLjM2OTFDMC45MDYxMDQgMTIuMzcwMSAwLjgxMjEwOSAxMi4zOTcxIDAuNzMwMTA5IDEyLjQ0ODFDMC42NDkxMDkgMTIuNTAwMSAwLjU4MzExNCAxMi41NzMxIDAuNTQxMTE0IDEyLjY2MDFDMC40OTgxMTQgMTIuNzQ3MSAwLjQ4MTExMSAxMi44NDMxIDAuNDkxMTExIDEyLjkzOTFDMC41MDExMTEgMTMuMDM2MSAwLjUzNzEwNiAxMy4xMjcxIDAuNTk2MTA2IDEzLjIwMzFMNy4xMjMxMSAyMS42MzcxTDMuODc1MTEgMzEuNzk1MUMzLjg0NTExIDMxLjg4NzEgMy44NDIxMSAzMS45ODUxIDMuODY2MTEgMzIuMDc5MUMzLjg4OTExIDMyLjE3MzEgMy45MzkxMSAzMi4yNTgxIDQuMDA4MTEgMzIuMzI1MUM0LjA3NzExIDMyLjM5MjEgNC4xNjQxIDMyLjQzODEgNC4yNTkxIDMyLjQ1OTFDNC4zNTMxIDMyLjQ3OTEgNC40NTExMSAzMi40NzMyIDQuNTQyMTEgMzIuNDQwMkwxNC41ODAxIDI4Ljg0MDFMMjMuMjM4MSAzNS4wNjgxQzIzLjMxNjEgMzUuMTI0MSAyMy40MDkxIDM1LjE1NzIgMjMuNTA1MSAzNS4xNjQyQzIzLjYwMTEgMzUuMTcwMiAyMy42OTgxIDM1LjE0OTIgMjMuNzgzMSAzNS4xMDQyQzIzLjg2ODEgMzUuMDU5MiAyMy45MzkxIDM0Ljk5MDEgMjMuOTg3MSAzNC45MDcxQzI0LjAzNjEgMzQuODIzMSAyNC4wNjAxIDM0LjcyODEgMjQuMDU3MSAzNC42MzIxTDIzLjczNTEgMjMuOTcyMUwzMi4zMzMxIDE3LjY2NDFDMzIuNDExMSAxNy42MDYxIDMyLjQ3MTEgMTcuNTI5MSAzMi41MDcxIDE3LjQzOTFDMzIuNTQzMSAxNy4zNDkxIDMyLjU1MzEgMTcuMjUyMSAzMi41MzYxIDE3LjE1NzFDMzIuNTIwMSAxNy4wNjExIDMyLjQ3NzEgMTYuOTczMSAzMi40MTIxIDE2LjkwMTFDMzIuMzQ4MSAxNi44MjkxIDMyLjI2NTEgMTYuNzc3MSAzMi4xNzIxIDE2Ljc1MDFMMjEuOTM0MSAxMy43NjIxTDE4LjU5MjEgMy42MzUxM0MxOC41NjExIDMuNTQxMTMgMTguNTAzMSAzLjQ1ODExIDE4LjQyNzEgMy4zOTYxMUMxOC4zNTAxIDMuMzMzMTEgMTguMjU3MSAzLjI5NDE0IDE4LjE1OTEgMy4yODMxNFoiIGZpbGw9IiNFNjUzMjEiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0zMi41MzUzIDE3LjM0OTdMMzIuOTMxMyAxNC41Mjg3TDMwLjMxODMgMTQuMTYxN0wyOS45MjIzIDE2Ljk4MjdMMzIuNTM1MyAxNy4zNDk3WiIgZmlsbD0iI0U2NTMyMSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTMuMTAxNyAxMy4yMTNMMy40OTY3IDEwLjM5MkwwLjg4MjcwNiAxMC4wMjZMMC40ODc3MDEgMTIuODQ3TDMuMTAxNyAxMy4yMTNaIiBmaWxsPSIjRTY1MzIxIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNC44NzQwNyAzMi4wNzQ5TDUuMjcwMDcgMjkuMjUzTDQuMjQzMDcgMjkuMTA5TDMuODQ3MDggMzEuOTMwOUw0Ljg3NDA3IDMyLjA3NDlaIiBmaWxsPSIjRTY1MzIxIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjQuMDQ1OSAzNC43NzAzTDI0LjQ0MTkgMzEuOTQ4M0wyMy40MTQ5IDMxLjgwNDNMMjMuMDE5IDM0LjYyNjNMMjQuMDQ1OSAzNC43NzAzWiIgZmlsbD0iI0U2NTMyMSIvPgo8cGF0aCBkPSJNMTguNTQ4MSAwLjUxMjEzOUMxOC40NTQxIDAuNTAxMTM5IDE4LjM1OTEgMC41MTYxMTUgMTguMjc0MSAwLjU1NjExNUMxOC4xODgxIDAuNTk1MTE1IDE4LjExNTEgMC42NTcxMzEgMTguMDYxMSAwLjczNTEzMUwxMi4wNTcxIDkuNTQ4MTJMMS4zOTIxMSA5LjU5ODE0QzEuMjk1MTEgOS41OTkxNCAxLjIwMTEgOS42MjYxMiAxLjExOTEgOS42NzcxMkMxLjAzODEgOS43MjkxMiAwLjk3MjEwNiA5LjgwMjEyIDAuOTMwMTA2IDkuODg5MTJDMC44ODcxMDYgOS45NzYxMiAwLjg3MDEwMyAxMC4wNzIxIDAuODgwMTAzIDEwLjE2ODFDMC44OTAxMDMgMTAuMjY1MSAwLjkyNjExNCAxMC4zNTYxIDAuOTg1MTE0IDEwLjQzMjFMNy41MTIxMSAxOC44NjYxTDQuMjY0MTEgMjkuMDI0MUM0LjIzNDExIDI5LjExNjEgNC4yMzExIDI5LjIxNDEgNC4yNTUxIDI5LjMwODFDNC4yNzgxIDI5LjQwMjEgNC4zMjgxIDI5LjQ4NzEgNC4zOTcxIDI5LjU1NDFDNC40NjYxIDI5LjYyMTEgNC41NTMxMSAyOS42NjcxIDQuNjQ4MTEgMjkuNjg4MUM0Ljc0MjExIDI5LjcwODEgNC44NDAxMSAyOS43MDEyIDQuOTMxMTEgMjkuNjY5MkwxNC45NjkxIDI2LjA2OTFMMjMuNjI3MSAzMi4yOTYxQzIzLjcwNTEgMzIuMzUzMSAyMy43OTgxIDMyLjM4NjIgMjMuODk0MSAzMi4zOTMyQzIzLjk5MDEgMzIuMzk5MiAyNC4wODcxIDMyLjM3ODIgMjQuMTcyMSAzMi4zMzMyQzI0LjI1NzEgMzIuMjg4MiAyNC4zMjgxIDMyLjIyMDEgMjQuMzc2MSAzMi4xMzYxQzI0LjQyNTEgMzIuMDUzMSAyNC40NDkxIDMxLjk1NzEgMjQuNDQ2MSAzMS44NjExTDI0LjEyNDEgMjEuMjAxMUwzMi43MjIxIDE0Ljg5MjFDMzIuODAwMSAxNC44MzUxIDMyLjg2MDEgMTQuNzU4MSAzMi44OTYxIDE0LjY2ODFDMzIuOTMyMSAxNC41NzgxIDMyLjk0MjEgMTQuNDgxMSAzMi45MjUxIDE0LjM4NjFDMzIuOTA5MSAxNC4yOTAxIDMyLjg2NjEgMTQuMjAyMSAzMi44MDExIDE0LjEzMDFDMzIuNzM3MSAxNC4wNTgxIDMyLjY1NDEgMTQuMDA2MSAzMi41NjExIDEzLjk3OTFMMjIuMzIzMSAxMC45OTExTDE4Ljk4MTEgMC44NjQxMjlDMTguOTUwMSAwLjc3MDEyOSAxOC44OTIxIDAuNjg3MTE1IDE4LjgxNjEgMC42MjUxMTVDMTguNzM5MSAwLjU2MjExNSAxOC42NDYxIDAuNTIzMTM5IDE4LjU0ODEgMC41MTIxMzlaIiBmaWxsPSIjRkZBNjAwIi8+CjxwYXRoIGQ9Ik0xMi4zMzA5IDEwLjA2NUwxLjM5Mzk1IDEwLjExNkw4LjA4Nzk1IDE4Ljc2NUw0Ljc1Njk0IDI5LjE4M0wxNS4wNTA5IDI1LjQ5TDIzLjkyNzkgMzEuODc3TDIzLjU5NzkgMjAuOTQ1TDMyLjQxNDkgMTQuNDc2TDIxLjkxNjkgMTEuNDEyTDE4LjQ4OSAxLjAyNTk3TDEyLjMzMDkgMTAuMDY1WiIgZmlsbD0iI0ZGQzYwMCIvPgo8cGF0aCBkPSJNMTcuOTI0MSA1LjA2MDEyQzE3LjgzMDEgNS4wNDYxMiAxNy43MzQxIDUuMDU5MTQgMTcuNjQ3MSA1LjA5ODE0QzE3LjU2MTEgNS4xMzYxNCAxNy40ODYxIDUuMTk4MTIgMTcuNDMzMSA1LjI3NjEyTDEzLjIyMzEgMTEuNDU0MUw1Ljc0ODExIDExLjQ4OTFDNS42NTQxMSAxMS40ODkxIDUuNTYxMSAxMS41MTYxIDUuNDgxMSAxMS41NjcxQzUuNDAxMSAxMS42MTcxIDUuMzM3MTEgMTEuNjg5MSA1LjI5NTExIDExLjc3MzFDNS4yNTQxMSAxMS44NTgxIDUuMjM3MTEgMTEuOTUzMSA1LjI0NzExIDEyLjA0NzFDNS4yNTYxMSAxMi4xNDExIDUuMjkyMSAxMi4yMzExIDUuMzUwMSAxMi4zMDUxTDkuOTI1MSAxOC4yMTgxTDcuNjQ4MTEgMjUuMzM4MUM3LjYxOTExIDI1LjQyODEgNy42MTYxIDI1LjUyNDEgNy42MzkxIDI1LjYxNjFDNy42NjIxIDI1LjcwODEgNy43MTExIDI1Ljc5MTIgNy43NzkxIDI1Ljg1NzJDNy44NDcxIDI1LjkyMjIgNy45MzIxIDI1Ljk2ODEgOC4wMjQxIDI1Ljk4ODFDOC4xMTYxIDI2LjAwODEgOC4yMTIxMSAyNi4wMDEyIDguMzAxMTEgMjUuOTY5MkwxNS4zMzgxIDIzLjQ0NTJMMjEuNDA2MSAyNy44MTExQzIxLjQ4MzEgMjcuODY2MSAyMS41NzQxIDI3Ljg5OTEgMjEuNjY4MSAyNy45MDUxQzIxLjc2MjEgMjcuOTEyMSAyMS44NTYxIDI3Ljg5MTEgMjEuOTQwMSAyNy44NDcxQzIyLjAyMzEgMjcuODAzMSAyMi4wOTMxIDI3LjczNjEgMjIuMTQwMSAyNy42NTQxQzIyLjE4ODEgMjcuNTcyMSAyMi4yMTExIDI3LjQ3OTIgMjIuMjA5MSAyNy4zODUyTDIxLjk4MzEgMTkuOTEyMUwyOC4wMTAxIDE1LjQ5MDFDMjguMDg2MSAxNS40MzQxIDI4LjE0NTEgMTUuMzU4MSAyOC4xODAxIDE1LjI3MDFDMjguMjE1MSAxNS4xODMxIDI4LjIyNTEgMTUuMDg3MSAyOC4yMDkxIDE0Ljk5NDFDMjguMTkzMSAxNC45MDExIDI4LjE1MDEgMTQuODE0MSAyOC4wODcxIDE0Ljc0NDFDMjguMDI0MSAxNC42NzMxIDI3Ljk0MzEgMTQuNjIyMSAyNy44NTIxIDE0LjU5NTFMMjAuNjc2MSAxMi41MDExTDE4LjMzMzEgNS40MDIxM0MxOC4zMDMxIDUuMzEzMTMgMTguMjQ5MSA1LjIzNDEyIDE4LjE3NzEgNS4xNzMxMkMxOC4xMDUxIDUuMTEzMTIgMTguMDE3MSA1LjA3MzEyIDE3LjkyNDEgNS4wNjAxMloiIGZpbGw9IiNGRkM2MDAiLz4KPHBhdGggZD0iTTEzLjQ5MTQgMTEuOTU5MUw1Ljc0OTQyIDExLjk5NTFMMTAuNDg3NCAxOC4xMTkxTDguMTI5NDEgMjUuNDkyMkwxNS40MTY0IDIyLjg3OTFMMjEuNzAxNCAyNy4zOTkxTDIxLjQ2NzQgMTkuNjYxMUwyNy43MDk0IDE1LjA4MjFMMjAuMjc3NCAxMi45MTMxTDE3Ljg1MDQgNS41NjExM0wxMy40OTE0IDExLjk1OTFaIiBmaWxsPSIjRkZBNjAwIi8+CjxwYXRoIGQ9Ik0xNy44NTIxIDUuNTYxMTNMMTMuNDkzMSAxMS45NTkxTDUuNzUxMSAxMS45OTUxTDcuOTAxMTEgMTQuNzc0MUMxMC4zNzExIDE1LjA1MjEgMTUuOTc4MSAxNi4wNTgxIDIxLjQ2OTEgMTkuNjYxMUwyNy43MTExIDE1LjA4MTFMMjAuMjc5MSAxMi45MTMxTDE3Ljg1MjEgNS41NjExM1oiIGZpbGw9IiNGRkFGMDAiLz4KPHBhdGggZD0iTTEzLjQ5MTQgMTEuOTU5MUw1Ljc0OTQyIDExLjk5NTFMNi4xNTY0MiAxMi41NjkxTDEzLjY3NjQgMTIuNTcyMUwxNy42ODM0IDYuNzI2MTRMMTcuODUwNCA1LjU2MTEzTDEzLjQ5MTQgMTEuOTU5MVoiIGZpbGw9IiNGRjg4MDAiLz4KPHBhdGggZD0iTTE3LjY5MTggNi43MjcxNEwxOS45MzE4IDEzLjQ1MTFMMjcuMTYyOCAxNS41MjExTDI3LjcxMTggMTUuMDgyMUwyMC4yNzkxIDEyLjkxMzFMMTcuODUyMSA1LjU2MTEzTDE3LjY5MTggNi43MjcxNFoiIGZpbGw9IiNGRjg4MDAiLz4KPHBhdGggZD0iTTE2Ljg0ODEgMTMuOTEwMUMxNy40NTUxIDEzLjk5NTEgMTguMDEzMSAxMy41OTUxIDE4LjA5NDEgMTMuMDE2MUMxOC4xNzYxIDEyLjQzNzEgMTcuNzUwMSAxMS44OTgxIDE3LjE0MzEgMTEuODEzMUMxNi41MzYxIDExLjcyNzEgMTUuOTc4MSAxMi4xMjgxIDE1Ljg5NjEgMTIuNzA3MUMxNS44MTUxIDEzLjI4NjEgMTYuMjQxMSAxMy44MjUxIDE2Ljg0ODEgMTMuOTEwMVoiIGZpbGw9InZhcigtLWZpbGwtMCwgI0ZGRUU3MykiLz4KPHBhdGggZD0iTTIyLjU4MzEgMTYuNzg1MUMyMi44MzExIDE2LjIzMjEgMjIuMDM4MSAxNS4zODYxIDIwLjgxMjEgMTQuODk1MUMxOS41ODYxIDE0LjQwNDEgMTguMzkxMSAxNC40NTQxIDE4LjE0MzEgMTUuMDA3MUMxNy44OTYxIDE1LjU2MDEgMTguNjg4MSAxNi40MDYxIDE5LjkxNDEgMTYuODk3MUMyMS4xNDAxIDE3LjM4ODEgMjIuMzM1MSAxNy4zMzgxIDIyLjU4MzEgMTYuNzg1MVoiIGZpbGw9InZhcigtLWZpbGwtMCwgI0ZGRUU3MykiLz4KPC9nPgo8L3N2Zz4K'), url('data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgdmlld0JveD0iMCAwIDMzLjQ3MiAzNS42Nzk2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZyBpZD0iVmVjdG9yIj4KPHBhdGggZD0iTTE4LjY0MzEgMC4wMDcxMjgyOEMxOC42MjkxIDAuMDA1MTI4MjggMTguNTg4MSAwLjAwMzEzMDQ4IDE4LjYwMjEgMC4wMDMxMzA0OEwxOC42MzAxIDAuMDA2MTIxMkMxOC4yNjAxIC0wLjAzNTg3ODggMTcuODcyMSAwLjE0MTExNCAxNy42NjIxIDAuNDQ5MTE0TDExLjgwOTEgOS4wNDAxMkwxLjQxNDEgOS4wODgxM0MwLjkzNjA5NyA5LjA5MTEzIDAuNDg4MTAzIDkuNDY4MTMgMC40MDQxMDMgOS45MzgxM0MwLjQwMzEwMyA5Ljk0NDEzIDAuNDAyMTA0IDkuOTUwMTEgMC40MDIxMDQgOS45NTcxMUwwLjAxMTA5NzYgMTIuNzM4MUwwLjAxMjEwNDcgMTIuNzI3MUMwLjAxMDEwNDcgMTIuNzQxMSAwLjAwODEwNzk1IDEyLjc1NjEgMC4wMDYxMDc5NSAxMi43NzAxTDAuMDA4MTA2ODUgMTIuNzU5MUwwLjAwNTEwMDg3IDEyLjc3ODFDLTAuMDA1ODk5MTMgMTIuODU0MSAwLjAwMTA5ODA2IDEyLjkzMTEgMC4wMjQwOTgxIDEzLjAwNTFDMC4wNDYwOTgxIDEzLjE5MTEgMC4xMDEwOTkgMTMuMzczMSAwLjIxNjA5OSAxMy41MjExTDYuMjI1MSAyMS4yODgxTDMuODAwMSAyOC44NzExVjI4Ljg3MjJDMy43NzgxIDI4Ljk0MDIgMy43NjQxMSAyOS4wMTExIDMuNzU2MTEgMjkuMDgyMUwzLjc1OTEgMjkuMDYyMUwzLjM3NjEgMzEuNzkyMUwzLjM3ODEgMzEuNzcyMUMzLjM3MzEgMzEuNzk5MSAzLjM2OTEgMzEuODI2MSAzLjM2NzEgMzEuODU0MUwzLjM3MDExIDMxLjgzNDFMMy4zNjYxMSAzMS44NjMxQzMuMzUxMTEgMzEuOTY3MSAzLjM2OTEgMzIuMDc0MSAzLjQxNzEgMzIuMTY3MUMzLjQ3MTEgMzIuNDA5MSAzLjU4MjExIDMyLjYzOTIgMy43ODIxMSAzMi43ODYyQzQuMDUzMTEgMzIuOTg1MiA0LjQyNDEgMzMuMDQwMiA0Ljc0MDEgMzIuOTI3MlYzMi45MjYxTDE0LjUyNTEgMjkuNDE3MUwyMi45NjMxIDM1LjQ4ODFDMjMuMjM2MSAzNS42ODQxIDIzLjYwODEgMzUuNzM0MiAyMy45MjMxIDM1LjYxNzJDMjQuMTU1MSAzNS41MzEyIDI0LjMyNTEgMzUuMzQxMSAyNC40NDQxIDM1LjEyNDFDMjQuNTE2MSAzNS4wNDcxIDI0LjU2MzEgMzQuOTQ5MSAyNC41NzgxIDM0Ljg0NDFMMjQuOTc1MSAzMi4wMjMyQzI0Ljk4MzEgMzEuOTY1MiAyNC45ODYxIDMxLjkwNzEgMjQuOTg0MSAzMS44NDkxTDI0Ljc0NDEgMjMuODkwMUwzMi42NjExIDE4LjA4MTFDMzIuODEyMSAxNy45NzAxIDMyLjkxNDEgMTcuODEwMSAzMi45ODYxIDE3LjYzODFDMzMuMDI5MSAxNy41NzQxIDMzLjA1NzEgMTcuNTAxMSAzMy4wNjgxIDE3LjQyNTFMMzMuMDcxMSAxNy40MDYxTDMzLjA2OTEgMTcuNDE3MUMzMy4wNzExIDE3LjQwMjEgMzMuMDczMSAxNy4zODcxIDMzLjA3NTEgMTcuMzczMUwzMy4wNzQxIDE3LjM4NDFMMzMuNDYwMSAxNC42MzUxTDMzLjQ1OTEgMTQuNjQ2MUMzMy40NjExIDE0LjYzMTEgMzMuNDYzMSAxNC42MTYxIDMzLjQ2NTEgMTQuNjAyMUMzMy40NjYxIDE0LjU5NjEgMzMuNDY2MSAxNC41OTExIDMzLjQ2NzEgMTQuNTg0MUMzMy41MTYxIDE0LjExMDEgMzMuMTg5MSAxMy42MjQxIDMyLjczMTEgMTMuNDkwMUwyMi43NTIxIDEwLjU3ODFMMTkuNDk1MSAwLjcwNzExQzE5LjM3MzEgMC4zMzkxMSAxOS4wMjgxIDAuMDU1MTI4MyAxOC42NDQxIDAuMDA3MTI4MjhIMTguNjQzMVoiIGZpbGw9IiNCNDFDMDAiLz4KPHBhdGggZD0iTTE4LjE1OTEgMy4yODMxNEMxOC4wNjUxIDMuMjcyMTQgMTcuOTcwMSAzLjI4NzExIDE3Ljg4NTEgMy4zMjcxMUMxNy43OTkxIDMuMzY2MTEgMTcuNzI2MSAzLjQyODEzIDE3LjY3MzEgMy41MDYxM0wxMS42NjgxIDEyLjMxOTFMMS4wMDMxIDEyLjM2OTFDMC45MDYxMDQgMTIuMzcwMSAwLjgxMjEwOSAxMi4zOTcxIDAuNzMwMTA5IDEyLjQ0ODFDMC42NDkxMDkgMTIuNTAwMSAwLjU4MzExNCAxMi41NzMxIDAuNTQxMTE0IDEyLjY2MDFDMC40OTgxMTQgMTIuNzQ3MSAwLjQ4MTExMSAxMi44NDMxIDAuNDkxMTExIDEyLjkzOTFDMC41MDExMTEgMTMuMDM2MSAwLjUzNzEwNiAxMy4xMjcxIDAuNTk2MTA2IDEzLjIwMzFMNy4xMjMxMSAyMS42MzcxTDMuODc1MTEgMzEuNzk1MUMzLjg0NTExIDMxLjg4NzEgMy44NDIxMSAzMS45ODUxIDMuODY2MTEgMzIuMDc5MUMzLjg4OTExIDMyLjE3MzEgMy45MzkxMSAzMi4yNTgxIDQuMDA4MTEgMzIuMzI1MUM0LjA3NzExIDMyLjM5MjEgNC4xNjQxIDMyLjQzODEgNC4yNTkxIDMyLjQ1OTFDNC4zNTMxIDMyLjQ3OTEgNC40NTExMSAzMi40NzMyIDQuNTQyMTEgMzIuNDQwMkwxNC41ODAxIDI4Ljg0MDFMMjMuMjM4MSAzNS4wNjgxQzIzLjMxNjEgMzUuMTI0MSAyMy40MDkxIDM1LjE1NzIgMjMuNTA1MSAzNS4xNjQyQzIzLjYwMTEgMzUuMTcwMiAyMy42OTgxIDM1LjE0OTIgMjMuNzgzMSAzNS4xMDQyQzIzLjg2ODEgMzUuMDU5MiAyMy45MzkxIDM0Ljk5MDEgMjMuOTg3MSAzNC45MDcxQzI0LjAzNjEgMzQuODIzMSAyNC4wNjAxIDM0LjcyODEgMjQuMDU3MSAzNC42MzIxTDIzLjczNTEgMjMuOTcyMUwzMi4zMzMxIDE3LjY2NDFDMzIuNDExMSAxNy42MDYxIDMyLjQ3MTEgMTcuNTI5MSAzMi41MDcxIDE3LjQzOTFDMzIuNTQzMSAxNy4zNDkxIDMyLjU1MzEgMTcuMjUyMSAzMi41MzYxIDE3LjE1NzFDMzIuNTIwMSAxNy4wNjExIDMyLjQ3NzEgMTYuOTczMSAzMi40MTIxIDE2LjkwMTFDMzIuMzQ4MSAxNi44MjkxIDMyLjI2NTEgMTYuNzc3MSAzMi4xNzIxIDE2Ljc1MDFMMjEuOTM0MSAxMy43NjIxTDE4LjU5MjEgMy42MzUxM0MxOC41NjExIDMuNTQxMTMgMTguNTAzMSAzLjQ1ODExIDE4LjQyNzEgMy4zOTYxMUMxOC4zNTAxIDMuMzMzMTEgMTguMjU3MSAzLjI5NDE0IDE4LjE1OTEgMy4yODMxNFoiIGZpbGw9IiNFNjUzMjEiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0zMi41MzUzIDE3LjM0OTdMMzIuOTMxMyAxNC41Mjg3TDMwLjMxODMgMTQuMTYxN0wyOS45MjIzIDE2Ljk4MjdMMzIuNTM1MyAxNy4zNDk3WiIgZmlsbD0iI0U2NTMyMSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTMuMTAxNyAxMy4yMTNMMy40OTY3IDEwLjM5MkwwLjg4MjcwNiAxMC4wMjZMMC40ODc3MDEgMTIuODQ3TDMuMTAxNyAxMy4yMTNaIiBmaWxsPSIjRTY1MzIxIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNC44NzQwNyAzMi4wNzQ5TDUuMjcwMDcgMjkuMjUzTDQuMjQzMDcgMjkuMTA5TDMuODQ3MDggMzEuOTMwOUw0Ljg3NDA3IDMyLjA3NDlaIiBmaWxsPSIjRTY1MzIxIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjQuMDQ1OSAzNC43NzAzTDI0LjQ0MTkgMzEuOTQ4M0wyMy40MTQ5IDMxLjgwNDNMMjMuMDE5IDM0LjYyNjNMMjQuMDQ1OSAzNC43NzAzWiIgZmlsbD0iI0U2NTMyMSIvPgo8cGF0aCBkPSJNMTguNTQ4MSAwLjUxMjEzOUMxOC40NTQxIDAuNTAxMTM5IDE4LjM1OTEgMC41MTYxMTUgMTguMjc0MSAwLjU1NjExNUMxOC4xODgxIDAuNTk1MTE1IDE4LjExNTEgMC42NTcxMzEgMTguMDYxMSAwLjczNTEzMUwxMi4wNTcxIDkuNTQ4MTJMMS4zOTIxMSA5LjU5ODE0QzEuMjk1MTEgOS41OTkxNCAxLjIwMTEgOS42MjYxMiAxLjExOTEgOS42NzcxMkMxLjAzODEgOS43MjkxMiAwLjk3MjEwNiA5LjgwMjEyIDAuOTMwMTA2IDkuODg5MTJDMC44ODcxMDYgOS45NzYxMiAwLjg3MDEwMyAxMC4wNzIxIDAuODgwMTAzIDEwLjE2ODFDMC44OTAxMDMgMTAuMjY1MSAwLjkyNjExNCAxMC4zNTYxIDAuOTg1MTE0IDEwLjQzMjFMNy41MTIxMSAxOC44NjYxTDQuMjY0MTEgMjkuMDI0MUM0LjIzNDExIDI5LjExNjEgNC4yMzExIDI5LjIxNDEgNC4yNTUxIDI5LjMwODFDNC4yNzgxIDI5LjQwMjEgNC4zMjgxIDI5LjQ4NzEgNC4zOTcxIDI5LjU1NDFDNC40NjYxIDI5LjYyMTEgNC41NTMxMSAyOS42NjcxIDQuNjQ4MTEgMjkuNjg4MUM0Ljc0MjExIDI5LjcwODEgNC44NDAxMSAyOS43MDEyIDQuOTMxMTEgMjkuNjY5MkwxNC45NjkxIDI2LjA2OTFMMjMuNjI3MSAzMi4yOTYxQzIzLjcwNTEgMzIuMzUzMSAyMy43OTgxIDMyLjM4NjIgMjMuODk0MSAzMi4zOTMyQzIzLjk5MDEgMzIuMzk5MiAyNC4wODcxIDMyLjM3ODIgMjQuMTcyMSAzMi4zMzMyQzI0LjI1NzEgMzIuMjg4MiAyNC4zMjgxIDMyLjIyMDEgMjQuMzc2MSAzMi4xMzYxQzI0LjQyNTEgMzIuMDUzMSAyNC40NDkxIDMxLjk1NzEgMjQuNDQ2MSAzMS44NjExTDI0LjEyNDEgMjEuMjAxMUwzMi43MjIxIDE0Ljg5MjFDMzIuODAwMSAxNC44MzUxIDMyLjg2MDEgMTQuNzU4MSAzMi44OTYxIDE0LjY2ODFDMzIuOTMyMSAxNC41NzgxIDMyLjk0MjEgMTQuNDgxMSAzMi45MjUxIDE0LjM4NjFDMzIuOTA5MSAxNC4yOTAxIDMyLjg2NjEgMTQuMjAyMSAzMi44MDExIDE0LjEzMDFDMzIuNzM3MSAxNC4wNTgxIDMyLjY1NDEgMTQuMDA2MSAzMi41NjExIDEzLjk3OTFMMjIuMzIzMSAxMC45OTExTDE4Ljk4MTEgMC44NjQxMjlDMTguOTUwMSAwLjc3MDEyOSAxOC44OTIxIDAuNjg3MTE1IDE4LjgxNjEgMC42MjUxMTVDMTguNzM5MSAwLjU2MjExNSAxOC42NDYxIDAuNTIzMTM5IDE4LjU0ODEgMC41MTIxMzlaIiBmaWxsPSIjRkZBNjAwIi8+CjxwYXRoIGQ9Ik0xMi4zMzA5IDEwLjA2NUwxLjM5Mzk1IDEwLjExNkw4LjA4Nzk1IDE4Ljc2NUw0Ljc1Njk0IDI5LjE4M0wxNS4wNTA5IDI1LjQ5TDIzLjkyNzkgMzEuODc3TDIzLjU5NzkgMjAuOTQ1TDMyLjQxNDkgMTQuNDc2TDIxLjkxNjkgMTEuNDEyTDE4LjQ4OSAxLjAyNTk3TDEyLjMzMDkgMTAuMDY1WiIgZmlsbD0iI0ZGQzYwMCIvPgo8cGF0aCBkPSJNMTcuOTI0MSA1LjA2MDEyQzE3LjgzMDEgNS4wNDYxMiAxNy43MzQxIDUuMDU5MTQgMTcuNjQ3MSA1LjA5ODE0QzE3LjU2MTEgNS4xMzYxNCAxNy40ODYxIDUuMTk4MTIgMTcuNDMzMSA1LjI3NjEyTDEzLjIyMzEgMTEuNDU0MUw1Ljc0ODExIDExLjQ4OTFDNS42NTQxMSAxMS40ODkxIDUuNTYxMSAxMS41MTYxIDUuNDgxMSAxMS41NjcxQzUuNDAxMSAxMS42MTcxIDUuMzM3MTEgMTEuNjg5MSA1LjI5NTExIDExLjc3MzFDNS4yNTQxMSAxMS44NTgxIDUuMjM3MTEgMTEuOTUzMSA1LjI0NzExIDEyLjA0NzFDNS4yNTYxMSAxMi4xNDExIDUuMjkyMSAxMi4yMzExIDUuMzUwMSAxMi4zMDUxTDkuOTI1MSAxOC4yMTgxTDcuNjQ4MTEgMjUuMzM4MUM3LjYxOTExIDI1LjQyODEgNy42MTYxIDI1LjUyNDEgNy42MzkxIDI1LjYxNjFDNy42NjIxIDI1LjcwODEgNy43MTExIDI1Ljc5MTIgNy43NzkxIDI1Ljg1NzJDNy44NDcxIDI1LjkyMjIgNy45MzIxIDI1Ljk2ODEgOC4wMjQxIDI1Ljk4ODFDOC4xMTYxIDI2LjAwODEgOC4yMTIxMSAyNi4wMDEyIDguMzAxMTEgMjUuOTY5MkwxNS4zMzgxIDIzLjQ0NTJMMjEuNDA2MSAyNy44MTExQzIxLjQ4MzEgMjcuODY2MSAyMS41NzQxIDI3Ljg5OTEgMjEuNjY4MSAyNy45MDUxQzIxLjc2MjEgMjcuOTEyMSAyMS44NTYxIDI3Ljg5MTEgMjEuOTQwMSAyNy44NDcxQzIyLjAyMzEgMjcuODAzMSAyMi4wOTMxIDI3LjczNjEgMjIuMTQwMSAyNy42NTQxQzIyLjE4ODEgMjcuNTcyMSAyMi4yMTExIDI3LjQ3OTIgMjIuMjA5MSAyNy4zODUyTDIxLjk4MzEgMTkuOTEyMUwyOC4wMTAxIDE1LjQ5MDFDMjguMDg2MSAxNS40MzQxIDI4LjE0NTEgMTUuMzU4MSAyOC4xODAxIDE1LjI3MDFDMjguMjE1MSAxNS4xODMxIDI4LjIyNTEgMTUuMDg3MSAyOC4yMDkxIDE0Ljk5NDFDMjguMTkzMSAxNC45MDExIDI4LjE1MDEgMTQuODE0MSAyOC4wODcxIDE0Ljc0NDFDMjguMDI0MSAxNC42NzMxIDI3Ljk0MzEgMTQuNjIyMSAyNy44NTIxIDE0LjU5NTFMMjAuNjc2MSAxMi41MDExTDE4LjMzMzEgNS40MDIxM0MxOC4zMDMxIDUuMzEzMTMgMTguMjQ5MSA1LjIzNDEyIDE4LjE3NzEgNS4xNzMxMkMxOC4xMDUxIDUuMTEzMTIgMTguMDE3MSA1LjA3MzEyIDE3LjkyNDEgNS4wNjAxMloiIGZpbGw9IiNGRkM2MDAiLz4KPHBhdGggZD0iTTEzLjQ5MTQgMTEuOTU5MUw1Ljc0OTQyIDExLjk5NTFMMTAuNDg3NCAxOC4xMTkxTDguMTI5NDEgMjUuNDkyMkwxNS40MTY0IDIyLjg3OTFMMjEuNzAxNCAyNy4zOTkxTDIxLjQ2NzQgMTkuNjYxMUwyNy43MDk0IDE1LjA4MjFMMjAuMjc3NCAxMi45MTMxTDE3Ljg1MDQgNS41NjExM0wxMy40OTE0IDExLjk1OTFaIiBmaWxsPSIjRkZBNjAwIi8+CjxwYXRoIGQ9Ik0xNy44NTIxIDUuNTYxMTNMMTMuNDkzMSAxMS45NTkxTDUuNzUxMSAxMS45OTUxTDcuOTAxMTEgMTQuNzc0MUMxMC4zNzExIDE1LjA1MjEgMTUuOTc4MSAxNi4wNTgxIDIxLjQ2OTEgMTkuNjYxMUwyNy43MTExIDE1LjA4MTFMMjAuMjc5MSAxMi45MTMxTDE3Ljg1MjEgNS41NjExM1oiIGZpbGw9IiNGRkFGMDAiLz4KPHBhdGggZD0iTTEzLjQ5MTQgMTEuOTU5MUw1Ljc0OTQyIDExLjk5NTFMNi4xNTY0MiAxMi41NjkxTDEzLjY3NjQgMTIuNTcyMUwxNy42ODM0IDYuNzI2MTRMMTcuODUwNCA1LjU2MTEzTDEzLjQ5MTQgMTEuOTU5MVoiIGZpbGw9IiNGRjg4MDAiLz4KPHBhdGggZD0iTTE3LjY5MTggNi43MjcxNEwxOS45MzE4IDEzLjQ1MTFMMjcuMTYyOCAxNS41MjExTDI3LjcxMTggMTUuMDgyMUwyMC4yNzkxIDEyLjkxMzFMMTcuODUyMSA1LjU2MTEzTDE3LjY5MTggNi43MjcxNFoiIGZpbGw9IiNGRjg4MDAiLz4KPHBhdGggZD0iTTE2Ljg0ODEgMTMuOTEwMUMxNy40NTUxIDEzLjk5NTEgMTguMDEzMSAxMy41OTUxIDE4LjA5NDEgMTMuMDE2MUMxOC4xNzYxIDEyLjQzNzEgMTcuNzUwMSAxMS44OTgxIDE3LjE0MzEgMTEuODEzMUMxNi41MzYxIDExLjcyNzEgMTUuOTc4MSAxMi4xMjgxIDE1Ljg5NjEgMTIuNzA3MUMxNS44MTUxIDEzLjI4NjEgMTYuMjQxMSAxMy44MjUxIDE2Ljg0ODEgMTMuOTEwMVoiIGZpbGw9InZhcigtLWZpbGwtMCwgI0ZGRUU3MykiLz4KPHBhdGggZD0iTTIyLjU4MzEgMTYuNzg1MUMyMi44MzExIDE2LjIzMjEgMjIuMDM4MSAxNS4zODYxIDIwLjgxMjEgMTQuODk1MUMxOS41ODYxIDE0LjQwNDEgMTguMzkxMSAxNC40NTQxIDE4LjE0MzEgMTUuMDA3MUMxNy44OTYxIDE1LjU2MDEgMTguNjg4MSAxNi40MDYxIDE5LjkxNDEgMTYuODk3MUMyMS4xNDAxIDE3LjM4ODEgMjIuMzM1MSAxNy4zMzgxIDIyLjU4MzEgMTYuNzg1MVoiIGZpbGw9InZhcigtLWZpbGwtMCwgI0ZGRUU3MykiLz4KPC9nPgo8L3N2Zz4K');
        background-repeat: no-repeat;
        background-position: center 1mm, center 11.3mm;
        background-size: 7.7mm 8.2mm, 9.7mm 10.3mm;
    }

    .school-stat-bubbles {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2.4mm;
      min-width: 58mm;
      margin-top: 0;
      padding: 0 1.2mm 0 0;
    }

    .school-stat-bubble {
      position: relative;
      display: block;
      width: 162.245px;
      height: 144.502px;
      top: 0;
      left: 0;
      margin-bottom: 0.8mm;
      background-repeat: no-repeat;
      background-position: center center;
      background-size: 100% 100%;
    }

    .school-stat-bubble.school-stat-bubble-matematica {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='149' height='146' viewBox='0 0 148.822 146.002' preserveAspectRatio='none'%3E%3Cg transform='matrix(-1,0,0,-1,148.822,146.002)'%3E%3Cpath d='M142.729 145.252H6.09302C3.14202 145.252 0.75 142.855 0.75 139.899V14.9273C0.75 11.9713 3.14202 9.57426 6.09302 9.57426H28.663C29.823 9.72126 31.583 8.94725 32.596 7.84525L38.434 1.48725C39.383 0.504252 40.884 0.504252 41.787 1.48725L47.625 7.84525C48.302 8.80025 50.062 9.57426 51.557 9.57426H142.729C145.68 9.57426 148.072 11.9713 148.072 14.9273V139.899C148.073 142.855 145.68 145.252 142.729 145.252Z' fill='white' stroke='%2300A59F' stroke-width='1.5' stroke-miterlimit='10' vector-effect='non-scaling-stroke'/%3E%3C/g%3E%3C/svg%3E");
    }

    .school-stat-bubble.school-stat-bubble-linguagens {
      top: -9px;
      left: 52.9134px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='149' height='146' viewBox='0 0 148.822 146.002' preserveAspectRatio='none'%3E%3Cpath d='M142.729 145.252H6.09302C3.14202 145.252 0.75 142.855 0.75 139.899V14.9273C0.75 11.9713 3.14202 9.57426 6.09302 9.57426H28.663C29.823 9.72126 31.583 8.94725 32.596 7.84525L38.434 1.48725C39.383 0.504252 40.884 0.504252 41.787 1.48725L47.625 7.84525C48.302 8.80025 50.062 9.57426 51.557 9.57426H142.729C145.68 9.57426 148.072 11.9713 148.072 14.9273V139.899C148.073 142.855 145.68 145.252 142.729 145.252Z' fill='white' stroke='%2300A59F' stroke-width='1.5' stroke-miterlimit='10' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E");
    }

    .school-stat-bubble > *:not(.school-stat-icon):not(.school-stat-value):not(.school-stat-copy) {
      position: relative;
      z-index: 1;
    }

    .school-stat-bubble > .school-stat-icon {
      z-index: 2;
    }

    .school-stat-bubble:nth-child(2) {
      margin-left: 52.9134px;
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
      width: 28.347px;
      height: 28.346px;
      box-shadow: none;
      border-radius: ${brSm};
      overflow: hidden;
    }

    .school-stat-bubble.school-stat-bubble-matematica .school-stat-icon {
      top: 50px;
      left: -14.924px;
      transform: none;
    }

    .school-stat-bubble.school-stat-bubble-linguagens .school-stat-icon {
      top: 56px;
      left: -14.924px;
      transform: none;
    }

    .school-stat-icon svg,
    .reference-area-icon svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .school-stat-icon.discipline-matematica {
      background: ${c.brandGreen};
      color: #FFFFFF;
    }

    .school-stat-icon.discipline-linguagens {
      background: ${c.brandOrange};
      color: #FFFFFF;
    }

    .discipline-matematica {
      background: ${accentColor};
    }

    .discipline-linguagens {
      background: ${c.brandPurple || c.accent};
    }

    .school-stat-value {
      font-family: ${displayFontStack};
      position: absolute;
      z-index: 1;
      font-size: 52px;
      font-weight: ${wExtrabold};
      line-height: 1;
      color: ${c.secondary};
      margin: 0;
      white-space: nowrap;
    }

    .school-stat-bubble.school-stat-bubble-matematica .school-stat-value {
      top: 10px;
      left: 22px;
    }

    .school-stat-bubble.school-stat-bubble-linguagens .school-stat-value {
      top: 16px;
      left: 22px;
    }

    .school-stat-bubble-header {
      display: none;
    }

    .school-stat-heading {
      display: none;
    }

    .school-stat-copy {
      position: absolute;
      z-index: 1;
      margin: 0;
      color: ${brandStrong};
      font-size: 9px;
      line-height: 13px;
      letter-spacing: 0;
      width: 116px;
    }



    .school-stat-bubble.school-stat-bubble-matematica .school-stat-copy {
      top: 65px;
      left: 22px;
    }

    .school-stat-bubble.school-stat-bubble-linguagens .school-stat-copy {
      top: 71px;
      left: 22px;
    }

    .school-editorial-panel {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 2.2mm;
      padding: 4.2mm 4.8mm 4.6mm;
      border: ${bwHairline} solid rgba(19, 61, 89, 0.12);
      border-radius: ${brXxl};
      background: ${surfaceEditorialPanel};
    }

    .school-editorial-panel-title {
      margin: 0;
      color: ${brandStrong};
      font-size: ${szEditorialTitle}pt;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }

    .school-editorial-points {
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
    }

    .school-editorial-point {
      display: grid;
      grid-template-columns: 1.8mm minmax(0, 1fr);
      gap: 1.4mm;
      align-items: start;
      color: ${textEditorialSoft};
      font-size: ${szEditorialPoint}pt;
      line-height: 1.36;
    }

    .school-editorial-point::before {
      content: '';
      width: 1.5mm;
      height: 1.5mm;
      margin-top: 0.7mm;
      border-radius: 50%;
      background: ${c.secondary};
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
      border-radius: ${brXl};
      flex-shrink: 0;
    }

    .reference-area-chip {
      padding: 1.6mm 4.2mm;
      border-radius: 999px;
      background: ${c.secondary};
      color: #FFFFFF;
      font-size: ${szRefChipBase}pt;
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
      font-size: ${szRefLabelBase}pt;
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
      font-size: ${szRefAxisBase}pt;
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
      border-radius: ${brLg};
      border-left: 2px solid ${brandStrong};
      background: ${trackBg};
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

    .reference-distribution-cap {
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
      color: ${textReferenceSubtle};
      font-size: ${szRefStat}pt;
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
      color: ${textReferenceMuted};
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
      min-height: 210mm;
    }

    .editorial-split {
      display: grid;
      grid-template-columns: 55% 45%;
      min-height: 210mm;
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
      padding: 8mm 12mm 6mm 10mm;
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
      gap: 3.5mm;
      margin-top: 5mm;
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
      margin-top: 6mm;
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
      min-height: 210mm;
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
      min-height: 210mm;
      width: 100%;
      padding: 10mm 12mm 8mm;
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
      min-height: 210mm;
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
  const isSchoolComparison = page.section === 'escola_disciplinas';
  const framedHeaderCaption = isSchoolComparison
    ? 'Relatório Diagnóstico Educacional'
    : (chrome.editionLabel || '');
  const framedFooterLabel = isSchoolComparison ? 'Resultados' : '';
  const framedMeta = [
    chrome.sectionLabel,
    chrome.pageLabel,
    chrome.footerCenter,
    chrome.footerRight,
    chrome.rankingBadge,
  ].filter(Boolean).join(' • ');

  const showChrome = page.section !== 'escola';
  const chromeHeader = showChrome ? `
      <div class="framed-chrome-header">
        <span>${escapeHtml(chrome.sectionLabel || '')}</span>
        <span>${escapeHtml(framedHeaderCaption)}</span>
      </div>` : '';
  const chromeFooter = showChrome ? `
      <div class="framed-chrome-footer">
        <span class="framed-chrome-page-number">${escapeHtml(chrome.pageBadgeValue || '')}</span>
        ${framedFooterLabel ? `<span class="framed-chrome-footer-label">${escapeHtml(framedFooterLabel)}</span>` : ''}
      </div>` : '';

  return `
    <section class="${pageClasses.join(' ')} section-${escapeHtml(page.section)}"${layoutAttributes} aria-labelledby="${frameHeadingId}">
      <div class="framed-page-meta sr-only">${escapeHtml(framedMeta)}</div>
      ${chromeHeader}
      <div class="page-content page-content-framed">
        <h1 class="sr-only" id="${frameHeadingId}">${escapeHtml(data.layoutHeading || page.title || chrome.sectionLabel || 'Página')}</h1>
        ${renderPageContent(page, charts, theme, layoutProfile, options.assetResolver)}
      </div>
      ${chromeFooter}
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
      const rankingComponentId = (data && data.componentId) || '';
      const rankingComponentAttr = rankingComponentId ? ` data-component-id="${escapeHtml(rankingComponentId)}"` : '';
      return `<div class="priority-template priority-template-ranking"${rankingComponentAttr}>${[
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
      ].join('')}</div>`;
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
      : '<div class="chapter-hero-bg-accent" aria-hidden="true"></div>'
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
    const leftColumnContent = page.section === 'visao_geral'
      ? renderOverviewInstitutionalComposite(page, distributionChart, theme)
      : distributionChart
        ? renderDistributionChart(distributionChart, theme, {
          panelClassName: '',
        })
        : '';
    const rightColumnContent = page.section === 'escola'
      ? renderSchoolDisciplineCards(page.data.distribuicaoPorDisciplina, page.data.resultadosPorAno, theme)
      : page.section === 'visao_geral'
        ? ''
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

  const componentId = (page.data && page.data.componentId) || '';
  const componentAttr = componentId ? ` data-component-id="${escapeHtml(componentId)}"` : '';

  return `
    <div class="priority-template priority-template-${escapeHtml(page.section)}"${componentAttr}>
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

  const componentId = (page.data && page.data.componentId) || '';
  const componentAttr = componentId ? ` data-component-id="${escapeHtml(componentId)}"` : '';

  return `<div class="priority-template priority-template-resultados-ano"${componentAttr}>${blocks.join('')}</div>`;
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

function renderOverviewInstitutionalComposite(page, chart, theme) {
  return [
    renderOverviewDistributionPanel(page, chart, theme),
    renderOverviewInstitutionalSummary(page),
  ].filter(Boolean).join('');
}

function renderOverviewDistributionPanel(page, chart, theme) {
  const distribuicao = (page.data && page.data.distribuicao) || {};
  const title = chart && chart.title
    ? chart.title
    : 'Proficiência e habilidades';

  return `
    <section class="chart-panel chart-panel-overview-distribution overview-reference-panel">
      <h3 class="chart-title">${escapeHtml(title)}</h3>
      ${renderReferenceDistributionRow('Rede', distribuicao, theme)}
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

  const componentId = (data && data.componentId) || '';
  const componentAttr = componentId ? ` data-component-id="${escapeHtml(componentId)}"` : '';

  return `
    <div class="priority-template priority-template-habilidades"${componentAttr}>
    ${hero}
    ${renderContextStrip(contextItems, styleFlags.isDenseTable ? 'dense-table-context-strip' : '')}
    ${pagination}
    ${renderHabilidadesTablePanel(component, pageIndex, styleFlags.isDenseTable ? {
    panelClassName: 'panel dense-table-panel dense-table-panel-skills',
    tableClassName: 'skills-table dense-table-table',
  } : {})}
    </div>
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
        'Leitura consolidada da participação, proficiência e desempenho por disciplina.',
        {
          kicker: 'Resultados da rede',
          panelClassName: 'hero-panel-overview',
          emphasis: {
            label: 'Participação média',
            value: formatMaybePercent(page.data.participacaoMedia),
            note: `${formatMaybeNumber(page.data.mediaGeral)} de média geral`,
          },
          chips: [
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

function renderSchoolSummaryHeader(data, schoolSubtitle, rankingLabel) {
  return `
    <div class="school-brand-block" data-component="school-summary-header">
      <div class="school-editorial-header">
        <div class="school-brand-eyebrow">${escapeHtml(data.schoolEyebrowPrefix || 'SME')} ${escapeHtml(data.municipio || 'Canoas')}</div>
        <p class="school-header-subtitle">${escapeHtml(schoolSubtitle)}</p>
        <p class="school-header-meta">${escapeHtml(rankingLabel)}</p>
      </div>
    </div>
  `;
}

function renderSchoolSummaryMascot(owlAsset) {
  if (!owlAsset) {
    return '';
  }

  return `
    <div class="school-hero-figure" data-component="school-summary-mascot" aria-hidden="true">
      <div class="school-owl-wrap">
        <img class="school-owl-image" src="${escapeHtml(owlAsset)}" alt="Mascote institucional" />
      </div>
    </div>
  `;
}

function renderSchoolSummaryKpiCards(data, operacional) {
  return `
    <div class="school-kpi-grid" data-component="school-summary-kpis">
      <article class="school-kpi-card">
        <div class="school-kpi-value">${escapeHtml(formatLocalizedInteger(operacional.iniciaram ?? data.totalAlunos))}</div>
        <div class="school-kpi-label">Alunos iniciaram</div>
        <div class="school-kpi-note">Pelo menos uma prova respondida</div>
      </article>
      <article class="school-kpi-card">
        <div class="school-kpi-value">${escapeHtml(formatLocalizedInteger(operacional.finalizaram ?? data.totalAlunos))}</div>
        <div class="school-kpi-label">Alunos finalizaram</div>
        <div class="school-kpi-note">Todas as provas respondidas</div>
      </article>
    </div>
  `;
}

function renderSchoolSummaryOperationalTable(data, participationRows) {
  const operacional = data.operacional || {};
  return `
    <table class="summary-table school-operational-table" data-component="school-summary-operational-table">
      <thead>
        <tr>
          <th scope="col"><span class="sr-only">Descrição</span></th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Alunos previstos</td>
          <td>${escapeHtml(formatLocalizedInteger(operacional.previstos ?? data.totalAlunos))}</td>
        </tr>
        <tr class="school-table-section-row">
          <th scope="colgroup" colspan="2">Participação por competência</th>
        </tr>
        ${participationRows.map((row) => `
          <tr>
            <td>${escapeHtml(row.disciplina)}</td>
            <td>${escapeHtml(formatLocalizedInteger(row.total))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderSchoolSummaryParticipationCallout(participationValue) {
  return `
    <div class="school-participation-feature" data-component="school-summary-participation-callout">
      <div class="school-participation-ghost-wrap">
        <div class="school-participation-number">${escapeHtml(participationValue)}</div>
        <span class="school-participation-stars" aria-hidden="true"></span>
      </div>
      <div class="school-participation-label">de participação</div>
    </div>
  `;
}

function renderSchoolSummaryEditorialPanel(summaryNarrative, editorialPoints) {
  return `
    <section class="school-editorial-panel" data-component="school-summary-editorial-panel">
      <h3 class="school-editorial-panel-title">Leitura geral da escola</h3>
      <p class="school-summary-copy">${escapeHtml(summaryNarrative)}</p>
      <div class="school-editorial-points">
        ${editorialPoints.map((point) => `<p class="school-editorial-point">${escapeHtml(point)}</p>`).join('')}
      </div>
    </section>
  `;
}

function renderSchoolSummaryProficiencyCallouts(disciplineHighlights) {
  return `
    <div class="school-stat-bubbles" data-component="school-summary-proficiency-callouts">
      ${disciplineHighlights.map((highlight) => renderSchoolStatBubble(highlight)).join('')}
    </div>
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
  const rankingLabel = data.rankingPosition
    ? `${data.rankingPosition}ª posição no ranking da rede`
    : 'Integra o recorte institucional da rede';
  const schoolSubtitle = data.layoutSubheading || 'Panorama geral da escola';
  const editorialPoints = [
    `${participationValue} de participação total entre ${formatLocalizedInteger(operacional.finalizaram ?? data.totalAlunos)} estudantes que concluíram a aplicação.`,
    `A média geral da escola foi ${formatMaybeNumber(data.media)}, em comparação a ${formatMaybeNumber(data.mediaRede)} pontos na rede.`,
    disciplineHighlights[0]
      ? `${formatLocalizedPercent(Math.round(Number(disciplineHighlights[0].percentual) || 0), 0)} dos alunos alcançaram níveis proficientes e avançados em ${disciplineHighlights[0].disciplina}.`
      : '',
  ].filter(Boolean);

  return `
    <div class="analytic-split" data-layout="${escapeHtml(layoutShell)}">
      <section class="school-summary-aside">
        ${renderSchoolSummaryHeader(data, schoolSubtitle, rankingLabel)}
        ${renderSchoolSummaryMascot(owlAsset)}
        <h2 class="school-name-display">${escapeHtml(data.nome_escola || 'Escola')}</h2>
        ${renderSchoolSummaryKpiCards(data, operacional)}
        ${renderSchoolSummaryOperationalTable(data, participationRows)}
        ${renderSchoolSummaryParticipationCallout(participationValue)}
        <div class="sr-only">Previstos Iniciaram Finalizaram Participação Total</div>
        ${data.rankingPosition ? `<div class="sr-only">${escapeHtml(`Posição Geral: ${data.rankingPosition}º`)}</div>` : ''}
        <div class="sr-only">${escapeHtml(`Distribuição de Proficiência — ${data.nome_escola || ''}`)}</div>
      </section>
      <section class="school-summary-main">
        <div class="school-summary-main-copy">
          ${renderSchoolSummaryEditorialPanel(summaryNarrative, editorialPoints)}
        </div>
        <div class="school-summary-main-metrics">
          ${renderSchoolSummaryProficiencyCallouts(disciplineHighlights)}
        </div>
        <div class="sr-only">${escapeHtml(data.sintese || '')}</div>
      </section>
    </div>
  `;
}

function renderSchoolComparisonHeader(heading, subheadingBase, subheadingAccent) {
  return `
    <div class="reference-school-area-title" data-component="escola-disciplinas-header">
      <h2 class="reference-school-area-heading">${escapeHtml(heading)}</h2>
      <p class="reference-school-area-subheading">${escapeHtml(subheadingBase)} <strong class="reference-school-area-subheading-accent">· ${escapeHtml(subheadingAccent)}</strong></p>
    </div>
  `;
}

function renderSchoolComparisonGrid(areaRows, theme, networkLabel) {
  return `
    <div class="reference-school-area-grid" data-component="escola-disciplinas-comparativos">
      ${areaRows.map((row) => renderReferenceDisciplineModule(row, theme, networkLabel)).join('')}
    </div>
  `;
}

function renderSchoolComparisonLegend(theme) {
  return `
    <div class="reference-area-legend" data-component="escola-disciplinas-legenda">
      ${renderReferenceLegendItem('<25% de acertos', 'abaixo_do_basico', theme)}
      ${renderReferenceLegendItem('≥25% de acertos', 'basico', theme)}
      ${renderReferenceLegendItem('≥50% de acertos', 'adequado', theme)}
      ${renderReferenceLegendItem('≥70% de acertos', 'avancado', theme)}
    </div>
  `;
}

function renderSchoolAreaPageContent(page, charts, theme) {
  const data = page.data || {};
  const areaRows = buildReferenceAreaRows(data);
  const layoutShell = resolveLayoutShell(page, 'school-comparison-shell');
  const networkLabel = data.schoolEyebrowPrefix || 'SME';
  const heading = data.layoutHeading || 'Proficiência e habilidades';
  const subheadingBase = 'por área do conhecimento';
  const subheadingAccent = data.nome_escola || data.chromeSectionLabel || 'Geral da Escola';

  return `
    <section class="reference-school-area" data-layout="${escapeHtml(layoutShell)}">
      ${renderSchoolComparisonHeader(heading, subheadingBase, subheadingAccent)}
      ${renderSchoolComparisonGrid(areaRows, theme, networkLabel)}
      ${renderSchoolComparisonLegend(theme)}
    </section>
    <div data-component="escola-disciplinas-distribuicao">
      ${renderComparativoContent(data, theme)}
    </div>
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

function renderOverviewInstitutionalSummary(page) {
  const distribuicao = (page.data && page.data.distribuicao) || {};
  const percentuais = distribuicao.percentuais || {};
  const participation = formatMaybePercent(page.data.participacaoMedia);
  const mediaGeral = formatMaybeNumber(page.data.mediaGeral);
  const totalAlunos = String(page.data.totalAlunos || 0);
  const totalEscolas = String(page.data.totalEscolas || 0);
  const proficientes = formatLocalizedPercent(Math.round(Number(percentuais.adequado || 0) + Number(percentuais.avancado || 0)), 0);
  const areaHighlights = summarizeOverviewDisciplineHighlights(page.data.mediasPorDisciplina);
  const summaryText = `A rede registra ${participation} de participação média entre ${totalAlunos} estudantes distribuídos em ${totalEscolas} escolas, com média geral ${mediaGeral} e ${proficientes} em níveis proficientes; ${areaHighlights.primary} ${areaHighlights.secondary}`;

  return `
    <section class="panel panel-overview-summary">
      <div class="summary-callout summary-callout-overview">
        <p class="overview-summary-lead">${escapeHtml(summaryText)}</p>
      </div>
    </section>
  `;
}

function summarizeOverviewDisciplineHighlights(mediasPorDisciplina = {}) {
  const entries = Object.entries(mediasPorDisciplina)
    .map(([disciplina, values]) => ({
      disciplina,
      media: Number(values && values.media),
    }))
    .filter((entry) => Number.isFinite(entry.media));

  if (entries.length === 0) {
    return {
      primary: 'A leitura por disciplina complementa a visão consolidada da rede e orienta os próximos aprofundamentos.',
      secondary: 'Use os painéis laterais para identificar diferenças de desempenho e concentração por nível.',
    };
  }

  entries.sort((left, right) => right.media - left.media);
  const strongest = entries[0];
  const weakest = entries[entries.length - 1];

  return {
    primary: `${strongest.disciplina} apresenta a maior média consolidada da rede, com ${formatMaybeNumber(strongest.media)}.`,
    secondary: `${weakest.disciplina} concentra a menor média observada, com ${formatMaybeNumber(weakest.media)}, e pede leitura complementar no resumo por disciplina.`,
  };
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
    .map((highlight) => `Em ${highlight.disciplina}, ${formatLocalizedPercent(Math.round(Number(highlight.percentual) || 0), 0)} dos estudantes apresentaram níveis proficientes e avançados.`)
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
      accent: '#FFB637',
      bubbleAccent: '#00A59F',
      label: 'Matemática',
    };
  }

  return {
    badgeClassName: 'discipline-linguagens',
    accent: '#856BC6',
    bubbleAccent: '#00A59F',
    label: disciplina || 'Disciplina',
  };
}

const REFERENCE_DISTRIBUTION_LEVELS = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
const REFERENCE_DISTRIBUTION_LEADING_CAP = 7;

function renderReferenceDisciplineModule(row, theme, networkLabel = 'SME') {
  return `
    <article class="reference-area-card">
      <div class="reference-area-card-head">
        <div class="reference-area-icon ${row.badgeClassName}">
          ${renderDisciplineBadgeIcon(row.disciplina)}
        </div>
        <div class="reference-area-chip ${row.badgeClassName}">${escapeHtml((row.label || row.disciplina || '').toUpperCase())}</div>
      </div>
      ${renderReferenceDistributionRow('Escola', row.escola, theme)}
      ${renderReferenceDistributionRow(networkLabel, row.rede, theme)}
    </article>
  `;
}

function renderReferenceDistributionRow(label, distribuicao, theme) {
  const ticks = Array.from({ length: 11 }, (_, index) => `<span>${index * 10}</span>`).join('');
  const percentuais = ((distribuicao || {}).percentuais) || {};
  const levelValues = REFERENCE_DISTRIBUTION_LEVELS.map((level) => Math.max(Number(percentuais[level] || 0), 0));
  const levelSum = levelValues.reduce((sum, v) => sum + v, 0);
  const neutralPercent = Math.max(0, 100 - levelSum);
  const neutralColor = resolveReferenceLeadingCapColor(theme);
  const neutralStat = `
    <span class="reference-distribution-stat reference-distribution-stat-neutral">
      <span class="reference-distribution-dot" style="background:${escapeHtml(neutralColor)}">···</span>
      <strong style="color:${escapeHtml(neutralColor)}">${escapeHtml(formatLocalizedPercent(neutralPercent, 2))}</strong>
    </span>
  `;
  const stats = REFERENCE_DISTRIBUTION_LEVELS.map((level) => {
    const levelColor = resolveLevelColor(level, theme);
    return `
    <span class="reference-distribution-stat">
      <span class="reference-distribution-dot" style="background:${escapeHtml(levelColor)}">${escapeHtml(resolveLevelGlyph(level))}</span>
      <strong style="color:${escapeHtml(levelColor)}">${escapeHtml(formatLocalizedPercent(percentuais[level] || 0, 2))}</strong>
    </span>
  `;
  }).join('');

  return `
    <div class="reference-distribution-block">
      <div class="reference-distribution-label">${escapeHtml(label)}</div>
      <div class="reference-distribution-body">
        <div class="reference-distribution-axis">${ticks}</div>
        ${renderReferenceDistributionTrack(distribuicao, theme)}
        <div class="reference-distribution-stats">${neutralStat}${stats}</div>
      </div>
    </div>
  `;
}

function renderReferenceDistributionTrack(distribuicao, theme) {
  const percentuais = ((distribuicao || {}).percentuais) || {};
  const totals = REFERENCE_DISTRIBUTION_LEVELS.map((level) => Math.max(Number(percentuais[level] || 0), 0));
  const total = totals.reduce((sum, value) => sum + value, 0);
  const usableTrack = 100 - REFERENCE_DISTRIBUTION_LEADING_CAP;
  const segments = REFERENCE_DISTRIBUTION_LEVELS.map((level, index) => {
    const percentual = totals[index];
    const scaledPercentual = total > 0 ? (percentual / total) * usableTrack : usableTrack / REFERENCE_DISTRIBUTION_LEVELS.length;
    return `
      <span
        class="reference-distribution-segment"
        style="flex:${scaledPercentual} 1 0;background:${escapeHtml(resolveLevelColor(level, theme))}"
      ></span>
    `;
  }).join('');

  return `<div class="reference-distribution-track"><span class="reference-distribution-cap" style="flex:${REFERENCE_DISTRIBUTION_LEADING_CAP} 0 0;background:${escapeHtml(resolveReferenceLeadingCapColor(theme))}"></span>${segments}</div>`;
}

function renderReferenceLegendItem(label, level, theme) {
  const levelColor = resolveLevelColor(level, theme);
  return `
    <span class="reference-legend-item" style="color:${escapeHtml(levelColor)}">
      <span class="reference-distribution-dot" style="background:${escapeHtml(levelColor)}"></span>
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

function resolveSchoolStatBubbleAssets(disciplina) {
  const normalized = normalizeDisciplineName(disciplina);
  if (normalized.includes('matemat')) {
    return {
      bubbleClassName: 'school-stat-bubble-matematica',
      iconClassName: 'discipline-matematica',
      copy: 'dos alunos apresentaram níveis proficientes e avançados em Matemática.',
    };
  }

  return {
    bubbleClassName: 'school-stat-bubble-linguagens',
    iconClassName: 'discipline-linguagens',
    copy: 'dos alunos apresentaram níveis proficientes e avançados em Língua Portuguesa.',
  };
}

function renderSchoolStatBubbleShape() {
  return `
    <svg class="school-stat-bubble-shape" xmlns="http://www.w3.org/2000/svg" width="149" height="146" viewBox="0 0 148.822 146.002" fill="none" aria-hidden="true">
      <path d="M142.729 145.252H6.09302C3.14202 145.252 0.75 142.855 0.75 139.899V14.9273C0.75 11.9713 3.14202 9.57426 6.09302 9.57426H28.663C29.823 9.72126 31.583 8.94725 32.596 7.84525L38.434 1.48725C39.383 0.504252 40.884 0.504252 41.787 1.48725L47.625 7.84525C48.302 8.80025 50.062 9.57426 51.557 9.57426H142.729C145.68 9.57426 148.072 11.9713 148.072 14.9273V139.899C148.073 142.855 145.68 145.252 142.729 145.252Z" fill="white" stroke="#00A59F" stroke-width="1.5" stroke-miterlimit="10" vector-effect="non-scaling-stroke"/>
    </svg>
  `;
}

function renderSchoolStatBubble(highlight) {
  const bubbleAssets = resolveSchoolStatBubbleAssets(highlight.disciplina);
  const roundedPercent = formatLocalizedPercent(Math.round(Number(highlight.percentual) || 0), 0);

  return `
    <article class="school-stat-bubble ${bubbleAssets.bubbleClassName}">
      <div class="school-stat-value">
        ${escapeHtml(roundedPercent)}
      </div>
      <p class="school-stat-copy">${escapeHtml(bubbleAssets.copy)}</p>
      <div class="school-stat-icon ${bubbleAssets.iconClassName}">
        ${renderDisciplineBadgeIcon(highlight.disciplina)}
      </div>
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
      <svg viewBox="0 0 28.347 28.346" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M10.9049 19.1339H11.8889V17.4019H13.6219V16.4169H11.8889V14.6849H10.9049V16.4169H9.17294V17.4019H10.9049V19.1339ZM15.1369 18.4449H19.0939V17.4799H15.1369V18.4449ZM15.1369 16.3389H19.0939V15.3549H15.1369V16.3389ZM15.8659 13.1299L17.0659 11.9289L18.2669 13.1299L18.976 12.4209L17.7749 11.2209L18.976 10.0199L18.2669 9.31091L17.0659 10.5119L15.8659 9.31091L15.157 10.0199L16.3579 11.2209L15.157 12.4209L15.8659 13.1299ZM9.46796 11.7129H13.326V10.7289H9.46796V11.7129ZM8.26694 21.2599C7.95194 21.2599 7.67694 21.1419 7.43994 20.9059C7.20394 20.6689 7.08594 20.3939 7.08594 20.0789V8.26791C7.08594 7.95291 7.20394 7.67692 7.43994 7.44092C7.67694 7.20492 7.95194 7.08691 8.26694 7.08691H20.0779C20.3929 7.08691 20.6689 7.20492 20.9049 7.44092C21.1409 7.67692 21.2589 7.95291 21.2589 8.26791V20.0789C21.2589 20.3939 21.1409 20.6689 20.9049 20.9059C20.6689 21.1419 20.3929 21.2599 20.0779 21.2599H8.26694ZM8.26694 20.0789H20.0779V8.26791H8.26694V20.0789Z" fill="#FFFFFF"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 28.347 28.346" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M17.6292 12.1643L15.7622 7.39932C15.6592 7.14632 15.3712 7.02132 15.1152 7.11932L10.3502 8.98633C10.0942 9.08733 9.96915 9.37733 10.0702 9.63333L11.9512 14.3983C12.0522 14.6543 12.3422 14.7793 12.5982 14.6783L17.3492 12.8113C17.6052 12.7103 17.7302 12.4203 17.6292 12.1643ZM12.4502 14.1323L10.6282 9.49631L15.2642 7.67133L17.0852 12.3103L12.4502 14.1323Z" fill="#FFFFFF"/>
      <path d="M13.0258 15.1553H7.92188C7.64687 15.1553 7.42285 15.3783 7.42285 15.6543V20.7603C7.42285 21.0363 7.64687 21.2593 7.92188 21.2593H13.0258C13.3018 21.2593 13.5249 21.0363 13.5249 20.7603V15.6543C13.5249 15.3783 13.3008 15.1553 13.0258 15.1553ZM12.9639 20.6963H7.98386V15.7163H12.9639V20.6963Z" fill="#FFFFFF"/>
      <path d="M20.5628 15.1271L15.6298 13.8151C15.3608 13.7501 15.0888 13.9121 15.0188 14.1801L13.7078 19.1121C13.6358 19.3791 13.7939 19.6521 14.0599 19.7231L18.9938 21.0351C19.2598 21.1061 19.5328 20.9481 19.6038 20.6821L20.9049 15.7381C20.9769 15.4751 20.8248 15.2031 20.5628 15.1271ZM19.0798 20.4521L14.2648 19.1881L15.5458 14.3761L20.3578 15.6571L19.0798 20.4521Z" fill="#FFFFFF"/>
      <path d="M15.524 11.4535C15.473 11.3565 15.406 11.2695 15.325 11.1955L13.924 9.71855L13.758 9.53953C13.717 9.49653 13.6709 9.45754 13.6209 9.42454C13.5709 9.39054 13.5129 9.36854 13.4529 9.35954C13.3089 9.34954 13.169 9.40555 13.072 9.51155C13.033 9.55855 13.006 9.61454 12.993 9.67354C12.979 9.74354 12.972 9.81555 12.974 9.88655V12.1376C12.979 12.2216 12.9839 12.2855 12.9879 12.3305C12.9899 12.3725 12.9979 12.4145 13.0129 12.4545C13.0399 12.5195 13.094 12.5706 13.161 12.5946C13.23 12.6226 13.306 12.6226 13.374 12.5946C13.444 12.5746 13.499 12.5225 13.523 12.4545C13.544 12.3465 13.551 12.2355 13.545 12.1265V11.7255L14.6519 11.2905L14.916 11.5715L15.036 11.6915C15.071 11.7275 15.1089 11.7605 15.1509 11.7865C15.1829 11.8065 15.2179 11.8175 15.2549 11.8205C15.2959 11.8235 15.3369 11.8166 15.3749 11.8016C15.4409 11.7736 15.494 11.7226 15.524 11.6586C15.552 11.5926 15.552 11.5185 15.524 11.4535ZM13.52 11.2485L13.481 9.97655L14.3329 10.9295L13.52 11.2485Z" fill="#FFFFFF"/>
      <path d="M11.1741 17.9896C11.4411 17.8896 11.6161 17.6326 11.6111 17.3476C11.6111 17.2656 11.597 17.1836 11.569 17.1066C11.542 17.0306 11.501 16.9586 11.449 16.8966C11.397 16.8346 11.3361 16.7816 11.2661 16.7396C11.1801 16.6886 11.0851 16.6535 10.9861 16.6385C10.8671 16.6205 10.746 16.6116 10.625 16.6136H9.69404C9.59304 16.6026 9.49205 16.6326 9.41405 16.6976C9.35005 16.7766 9.32006 16.8766 9.33006 16.9776V19.1756C9.32006 19.2756 9.34905 19.3756 9.41105 19.4556C9.48905 19.5226 9.59204 19.5536 9.69404 19.5426H10.5881C10.7191 19.5386 10.8491 19.5256 10.9781 19.5056C11.0841 19.4936 11.1871 19.4676 11.2861 19.4276C11.4241 19.3696 11.543 19.2726 11.625 19.1476C11.71 19.0146 11.7541 18.8606 11.7511 18.7046C11.7581 18.3576 11.5141 18.0566 11.1741 17.9896ZM9.92705 17.0646H10.3951C10.5581 17.0566 10.7211 17.0806 10.8741 17.1376C10.9801 17.1886 11.043 17.3006 11.031 17.4176C11.032 17.4836 11.0141 17.5486 10.9811 17.6056C10.9421 17.6806 10.8761 17.7386 10.7961 17.7656C10.6851 17.7976 10.5691 17.8116 10.4541 17.8076H9.91307L9.92705 17.0646ZM11.1491 18.6646C11.1491 18.9526 10.9491 19.0966 10.5491 19.0966H9.91307L9.92705 18.2446H10.535C10.696 18.2346 10.858 18.2696 11 18.3456C11.103 18.4176 11.1601 18.5396 11.1491 18.6646Z" fill="#FFFFFF"/>
      <path d="M18.7161 16.5963C18.6451 16.4193 18.5301 16.2633 18.3821 16.1423C18.2201 16.0063 18.0281 15.9103 17.8221 15.8623C17.6401 15.8113 17.4491 15.7973 17.2611 15.8203C17.0811 15.8423 16.9071 15.9023 16.7511 15.9963C16.5901 16.0953 16.4521 16.2273 16.3451 16.3833C16.2241 16.5603 16.1361 16.7583 16.0841 16.9663C16.0481 17.0993 16.0251 17.2353 16.0171 17.3723C16.0101 17.5013 16.0181 17.6303 16.0421 17.7563C16.0651 17.8763 16.1021 17.9933 16.1541 18.1043C16.2081 18.2173 16.2801 18.3223 16.3671 18.4123C16.4541 18.5013 16.5541 18.5763 16.6641 18.6343C16.7901 18.6993 16.9231 18.7503 17.0601 18.7853C17.2351 18.8353 17.4191 18.8503 17.6011 18.8273C17.7531 18.8033 17.8991 18.7483 18.0291 18.6643C18.1371 18.5973 18.2321 18.5123 18.3101 18.4123C18.3761 18.3293 18.4251 18.2343 18.4531 18.1323C18.4721 18.0663 18.4631 17.9953 18.4271 17.9363C18.3931 17.8773 18.3371 17.8343 18.2701 17.8183C18.2061 17.7953 18.1341 17.8043 18.0771 17.8433C18.0231 17.8883 17.9761 17.9413 17.9401 18.0003C17.8531 18.1273 17.7301 18.2243 17.5871 18.2803C17.4411 18.3283 17.2841 18.3283 17.1381 18.2803C17.0061 18.2553 16.8831 18.1943 16.7821 18.1043C16.6851 17.9933 16.6241 17.8553 16.6081 17.7093C16.5901 17.5203 16.6081 17.3303 16.6621 17.1483C16.7121 16.8673 16.8561 16.6113 17.0711 16.4223C17.2501 16.2823 17.4861 16.2393 17.7041 16.3043C17.8371 16.3353 17.9571 16.4053 18.0491 16.5063C18.1391 16.6183 18.2001 16.7503 18.2281 16.8903C18.2431 16.9653 18.2681 17.0363 18.3041 17.1033C18.3401 17.1533 18.3941 17.1883 18.4551 17.1993C18.5191 17.2163 18.5881 17.2053 18.6431 17.1683C18.7001 17.1333 18.7411 17.0783 18.7581 17.0143C18.7881 16.8733 18.7731 16.7273 18.7161 16.5963Z" fill="#FFFFFF"/>
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

function createComparativoColors(theme) {
  const colors = ((theme || {}).colors || DEFAULT_THEME.colors);
  return {
    escola: colors.secondary || colors.brandSecondary || colors.primary,
    rede: colors.primary || colors.brandPrimary || colors.textSubtle,
  };
}

function resolveReferenceLeadingCapColor(theme) {
  const colors = ((theme || {}).colors || DEFAULT_THEME.colors);
  return colors.textSubtle || '#969799';
}

function resolveLevelGlyph(level) {
  switch (level) {
    case 'abaixo_do_basico':
      return ':(';
    case 'basico':
      return ':|';
    case 'adequado':
      return ':)';
    case 'avancado':
      return ':D';
    default:
      return '';
  }
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
