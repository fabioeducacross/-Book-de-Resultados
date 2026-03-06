'use strict';

/**
 * Book de Resultados — Main Pipeline
 *
 * Orchestrates the full report generation pipeline:
 *
 *   XLSX spreadsheet
 *     ↓ parser       — parse spreadsheet into raw data
 *     ↓ validator    — validate data contract compliance
 *     ↓ normalizer   — compute metrics and rankings
 *     ↓ renderer     — build page objects
 *     ↓ charts       — generate chart descriptors per page
 *     ↓ exporter     — export to PPTX / JSON
 *
 * Usage:
 *   const { generateBook } = require('.');
 *   const result = await generateBook({ inputFile, outputDir, format: 'pptx' });
 */

const path = require('path');
const { parseSpreadsheet } = require('./parser');
const { validate } = require('./validator');
const { normalize } = require('./normalizer');
const { render } = require('./renderer');
const { generateChartsForPage } = require('./charts');
const { exportPptx, exportJson, buildOutputFilename } = require('./exporter');

/**
 * Generates the Book de Resultados from an XLSX file.
 *
 * @param {object} options
 * @param {string}   options.inputFile    - Absolute path to the XLSX spreadsheet
 * @param {string}   options.outputDir    - Directory where the output will be saved
 * @param {'pptx'|'json'} [options.format='pptx'] - Output format
 * @param {string}   [options.version='v1']  - Version string for the filename
 * @param {string}   [options.logoUrl]    - Optional logo URL for the cover
 * @param {string}   [options.imagemInstitucional] - Optional cover image URL
 * @param {boolean}  [options.strict=false] - If true, throw on validation warnings too
 *
 * @returns {Promise<GenerationResult>}
 * @throws {ValidationError} if data validation fails and strict=false is not set
 */
async function generateBook(options = {}) {
  const {
    inputFile,
    outputDir,
    format = 'pptx',
    version = 'v1',
    logoUrl,
    imagemInstitucional,
    strict = false,
  } = options;

  if (!inputFile) throw new Error('"inputFile" é obrigatório');
  if (!outputDir) throw new Error('"outputDir" é obrigatório');

  const startTime = Date.now();
  const log = [];

  // ── Step 1: Parse ──────────────────────────────────────────────────────────
  log.push({ step: 'parse', status: 'started', ts: new Date().toISOString() });
  let rawData;
  try {
    rawData = await parseSpreadsheet(inputFile);
    log.push({ step: 'parse', status: 'ok', ts: new Date().toISOString() });
  } catch (err) {
    log.push({ step: 'parse', status: 'error', message: err.message, ts: new Date().toISOString() });
    throw new Error(`Falha ao ler a planilha: ${err.message}`);
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
  const pages = render(metrics, { logoUrl, imagemInstitucional });
  log.push({ step: 'render', status: 'ok', pageCount: pages.length, ts: new Date().toISOString() });

  // ── Step 5: Generate chart descriptors ───────────────────────────────────
  log.push({ step: 'charts', status: 'started', ts: new Date().toISOString() });
  const chartsPerPage = pages.map((page) => generateChartsForPage(page));
  log.push({ step: 'charts', status: 'ok', ts: new Date().toISOString() });

  // ── Step 6: Export ─────────────────────────────────────────────────────────
  log.push({ step: 'export', status: 'started', format, ts: new Date().toISOString() });
  let outputFile;
  switch (format) {
    case 'pptx':
      outputFile = await exportPptx(pages, chartsPerPage, rawData.metadata, outputDir, { version });
      break;
    case 'json':
      outputFile = await exportJson(pages, chartsPerPage, rawData.metadata, outputDir, { version });
      break;
    default:
      throw new Error(`Formato não suportado: "${format}". Use 'pptx' ou 'json'.`);
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

module.exports = { generateBook, ValidationError, buildOutputFilename };
