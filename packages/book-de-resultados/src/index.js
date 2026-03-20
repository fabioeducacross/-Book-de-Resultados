'use strict';

/**
 * Book de Resultados — Main Pipeline
 *
 * Orchestrates the full report generation pipeline:
 *
 *   XLSX spreadsheet  OR  JSON payload (BackOffice API)
 *     ↓ parser / input-adapter  — parse into canonical contract
 *     ↓ validator               — validate data contract compliance
 *     ↓ normalizer              — compute metrics and rankings
 *     ↓ renderer                — build page objects
 *     ↓ charts                  — generate chart descriptors per page
 *     ↓ exporter                — export to PPTX / JSON / PDF
 *
 * Usage (XLSX — CLI):
 *   const { generateBook } = require('.');
 *   const result = await generateBook({ inputFile, outputDir, format: 'pdf' });
 *
 * Usage (JSON — BackOffice API):
 *   const { generateBook } = require('.');
 *   const result = await generateBook({ inputData: jsonPayload, outputDir, format: 'pdf' });
 */

const path = require('path');
const { parseSpreadsheet } = require('./parser');
const { validate } = require('./validator');
const { normalize } = require('./normalizer');
const { render } = require('./renderer');
const { generateChartsForPage } = require('./charts');
const { exportPptx, exportPdf, exportJson, buildOutputFilename } = require('./exporter');
const { createTheme, loadThemeFromPath, DEFAULT_THEME } = require('./theme');
const { loadDesignManifest, DEFAULT_DESIGN_MANIFEST_PATH } = require('./design-manifest');
const { adaptJsonPayload, validatePayloadShape } = require('./input-adapter');

/**
 * Generates the Book de Resultados from an XLSX file.
 *
 * @param {object} options
 * @param {string}   [options.inputFile]  - Absolute path to the XLSX spreadsheet (CLI mode)
 * @param {object}   [options.inputData]  - JSON payload from BackOffice API (service mode)
 * @param {string}   options.outputDir    - Directory where the output will be saved
 * @param {'pptx'|'pdf'|'json'} [options.format='pptx'] - Output format
 * @param {string}   [options.version='v1']  - Version string for the filename
 * @param {string}   [options.logoUrl]    - Optional logo URL for the cover
 * @param {string}   [options.imagemInstitucional] - Optional cover image URL
 * @param {object}   [options.editorialAssets] - Optional asset map for editorial chapter/opening images
 * @param {object}   [options.theme]      - Optional theme overrides (see src/theme.js)
 * @param {string}   [options.pdfBrowserPath] - Optional Chromium/Edge path for PDF export
 * @param {boolean}  [options.keepHtml=false] - Preserve the generated .print.html when exporting PDF
 * @param {boolean}  [options.reviewHtml=false] - Preserve the print HTML and emit a .print.review.json manifest tied to the current editorial baseline
 * @param {boolean}  [options.strict=false] - If true, throw on validation warnings too
 * @param {string}   [options.designManifestPath] - Optional path to a design manifest JSON file
 *
 * @returns {Promise<GenerationResult>}
 * @throws {ValidationError} if data validation fails and strict=false is not set
 */
async function generateBook(options = {}) {
  const {
    inputFile,
    inputData,
    outputDir,
    format = 'pptx',
    version = 'v1',
    logoUrl,
    imagemInstitucional,
    editorialAssets,
    theme: themeOverrides,
    pdfBrowserPath,
    keepHtml = false,
    reviewHtml = false,
    strict = false,
    designManifestPath = DEFAULT_DESIGN_MANIFEST_PATH,
  } = options;

  if (!inputFile && !inputData) throw new Error('"inputFile" ou "inputData" é obrigatório');
  if (inputFile && inputData) throw new Error('Use "inputFile" ou "inputData", não ambos');
  if (!outputDir) throw new Error('"outputDir" é obrigatório');

  const designManifest = loadDesignManifest(designManifestPath);
  const manifestBaseTheme = designManifest.theme.tokensFilePath
    ? loadThemeFromPath(designManifest.theme.tokensFilePath)
    : DEFAULT_THEME;
  const manifestTheme = createTheme(designManifest.theme.overrides || {}, manifestBaseTheme);
  const resolvedTheme = createTheme(themeOverrides || {}, manifestTheme);
  const resolvedLogoUrl = logoUrl || designManifest.assets.logoUrl;
  const resolvedImagemInstitucional = imagemInstitucional || designManifest.assets.imagemInstitucional;
  const resolvedEditorialAssets = editorialAssets || designManifest.assets.editorialAssets || null;

  const startTime = Date.now();
  const log = [];

  // ── Step 1: Parse / Adapt ──────────────────────────────────────────────────
  log.push({ step: 'parse', status: 'started', inputType: inputData ? 'json' : 'xlsx', ts: new Date().toISOString() });
  let rawData;
  try {
    if (inputData) {
      const shapeCheck = validatePayloadShape(inputData);
      if (!shapeCheck.valid) {
        throw new Error(`Payload JSON inválido: ${shapeCheck.errors.join('; ')}`);
      }
      rawData = adaptJsonPayload(inputData);
    } else {
      rawData = await parseSpreadsheet(inputFile);
    }
    log.push({ step: 'parse', status: 'ok', inputType: inputData ? 'json' : 'xlsx', ts: new Date().toISOString() });
  } catch (err) {
    log.push({ step: 'parse', status: 'error', message: err.message, ts: new Date().toISOString() });
    const label = inputData ? 'Falha ao adaptar payload JSON' : 'Falha ao ler a planilha';
    throw new Error(`${label}: ${err.message}`);
  }

  // ── Step 2: Validate ───────────────────────────────────────────────────────
  log.push({ step: 'validate', status: 'started', ts: new Date().toISOString() });
  const { valid, errors, warnings } = validate(rawData);
  log.push({ step: 'validate', status: valid ? 'ok' : 'failed', errors, warnings, ts: new Date().toISOString() });

  if (!valid) {
    const errorMsg = `Validação falhou com ${errors.length} erro(s):\n${errors.join('\n')}`;
    throw new ValidationError(errorMsg, errors, warnings);
  }

  if (strict && warnings.length > 0) {
    const warnMsg = `Modo estrito: ${warnings.length} aviso(s):\n${warnings.join('\n')}`;
    throw new ValidationError(warnMsg, [], warnings);
  }

  // ── Step 3: Normalize ──────────────────────────────────────────────────────
  log.push({ step: 'normalize', status: 'started', ts: new Date().toISOString() });
  const metrics = normalize(rawData);
  log.push({ step: 'normalize', status: 'ok', ts: new Date().toISOString() });

  // ── Step 4: Render ─────────────────────────────────────────────────────────
  log.push({ step: 'render', status: 'started', ts: new Date().toISOString() });
  const pages = render(metrics, {
    logoUrl: resolvedLogoUrl,
    imagemInstitucional: resolvedImagemInstitucional,
    editorialAssets: resolvedEditorialAssets,
    theme: resolvedTheme,
    designManifest,
  });
  log.push({ step: 'render', status: 'ok', pageCount: pages.length, ts: new Date().toISOString() });

  // ── Step 5: Generate chart descriptors ───────────────────────────────────
  log.push({ step: 'charts', status: 'started', ts: new Date().toISOString() });
  const chartsPerPage = pages.map((page) => generateChartsForPage(page, resolvedTheme));
  log.push({ step: 'charts', status: 'ok', ts: new Date().toISOString() });

  // ── Step 6: Export ─────────────────────────────────────────────────────────
  log.push({ step: 'export', status: 'started', format, ts: new Date().toISOString() });
  let outputFile;
  let artifacts = null;
  switch (format) {
    case 'pptx':
      outputFile = await exportPptx(pages, chartsPerPage, rawData.metadata, outputDir, {
        version,
        theme: resolvedTheme,
        designManifest,
      });
      break;
    case 'pdf': {
      const exportArtifacts = {};
      outputFile = await exportPdf(pages, chartsPerPage, rawData.metadata, outputDir, {
        version,
        theme: resolvedTheme,
        browserPath: pdfBrowserPath,
        keepHtml,
        reviewHtml,
        designManifest,
        artifactCollector: exportArtifacts,
      });
      if (Object.keys(exportArtifacts).length > 0) {
        artifacts = exportArtifacts;
      }
      break;
    }
    case 'json':
      outputFile = await exportJson(pages, chartsPerPage, rawData.metadata, outputDir, { version });
      break;
    default:
      throw new Error(`Formato não suportado: "${format}". Use 'pptx', 'pdf' ou 'json'.`);
  }
  log.push({ step: 'export', status: 'ok', outputFile, ts: new Date().toISOString() });

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    outputFile,
    pageCount: pages.length,
    durationMs,
    warnings,
    log,
    filename: path.basename(outputFile),
    ...(artifacts ? { artifacts } : {}),
  };
}

/**
 * Custom error class for validation failures.
 */
class ValidationError extends Error {
  constructor(message, errors = [], warnings = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

module.exports = {
  generateBook,
  ValidationError,
  buildOutputFilename,
  // Expose theme utilities for consumers who want to customize their book
  createTheme,
  // Expose adapter for direct usage by service layer
  adaptJsonPayload,
  validatePayloadShape,
};
