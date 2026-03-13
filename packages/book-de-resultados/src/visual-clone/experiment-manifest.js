'use strict';

/**
 * experiment-manifest.js — Visual Clone Experiment
 *
 * Generates the JSON experiment manifest for each iteration of the visual clone experiment.
 *
 * The manifest captures:
 *   - Reference identification (PDF page, fixture)
 *   - Capture parameters (viewport, scale, DPI)
 *   - Algorithm version
 *   - Final score and per-region scores
 *   - Prioritized divergence list
 *
 * Per Section 11.1 (item 5) of the experiment specification.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MANIFEST_VERSION = '1.0.0';

/**
 * Generates a SHA-256 hash of the given file (or buffer).
 * @param {string|Buffer} sourceOrBuffer
 * @returns {string} hex digest (first 12 chars)
 */
function fileHash(sourceOrBuffer) {
  const buf = Buffer.isBuffer(sourceOrBuffer)
    ? sourceOrBuffer
    : fs.readFileSync(sourceOrBuffer);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

/**
 * Builds the experiment manifest object.
 *
 * @param {{
 *   iterationId?: string,
 *   referenceParams: {
 *     pdfPath: string,
 *     pageIndex: number,
 *     pageLabel?: string,
 *     dpi: number,
 *   },
 *   captureParams: {
 *     htmlPath: string,
 *     viewport: { width: number, height: number },
 *     deviceScaleFactor: number,
 *     pageSelector?: string,
 *   },
 *   evalResult: object,
 *   corrections: Array,
 *   artefacts?: {
 *     referencePng?: string,
 *     renderPng?: string,
 *     diffPng?: string,
 *     metricsJson?: string,
 *   },
 *   previousScore?: number,
 * }} params
 * @returns {object} Manifest object (JSON-serialisable)
 */
function buildExperimentManifest(params) {
  const {
    iterationId,
    referenceParams,
    captureParams,
    evalResult,
    corrections,
    artefacts = {},
    previousScore = null,
  } = params;

  const now = new Date().toISOString();

  // Compute artefact hashes where files exist
  const artefactHashes = {};
  for (const [key, filePath] of Object.entries(artefacts)) {
    if (filePath && fs.existsSync(filePath)) {
      artefactHashes[key] = fileHash(filePath);
    }
  }

  const scoreGlobal = evalResult ? evalResult.scoreGlobal : null;
  const scoreDelta = scoreGlobal !== null && previousScore !== null
    ? Math.round((scoreGlobal - previousScore) * 1000) / 1000
    : null;

  const thresholdsMet = scoreGlobal !== null ? {
    globalMin090: scoreGlobal >= 0.90,
    layoutMin092: (evalResult.components && evalResult.components.layout) >= 0.92,
    pixelDriftBelow12pct: evalResult.global && evalResult.global.pixelDiffRatio <= 0.12,
    noCriticalRegionBelow085: !(evalResult.regions || []).some((r) => r.combinedScore < 0.85),
  } : null;

  return {
    manifestVersion: MANIFEST_VERSION,
    experimentId: 'visual-clone-visao-geral-rede',
    iterationId: iterationId || `iter-${Date.now()}`,
    generatedAt: now,
    targetPage: {
      section: 'visao_geral',
      label: 'Visão Geral da Rede',
    },
    referenceParams: {
      pdfPath: referenceParams.pdfPath,
      pageIndex: referenceParams.pageIndex,
      pageLabel: referenceParams.pageLabel || `Página ${referenceParams.pageIndex + 1}`,
      dpi: referenceParams.dpi,
    },
    captureParams: {
      htmlPath: captureParams.htmlPath,
      viewport: captureParams.viewport,
      deviceScaleFactor: captureParams.deviceScaleFactor,
      pageSelector: captureParams.pageSelector || '.page-wrapper',
    },
    algorithmVersion: MANIFEST_VERSION,
    scoringFormula: 'S = 0.35 × S_pixel + 0.30 × S_ssim + 0.35 × S_layout',
    results: evalResult
      ? {
        scoreGlobal,
        scoreDelta,
        components: evalResult.components || null,
        global: evalResult.global || null,
        regions: (evalResult.regions || []).map((r) => ({
          id: r.id,
          label: r.label,
          weight: r.weight,
          pixelScore: r.pixelScore,
          ssimScore: r.ssimScore,
          combinedScore: r.combinedScore,
        })),
        thresholdsMet,
      }
      : null,
    divergences: (evalResult && evalResult.divergences) ? evalResult.divergences : [],
    corrections: corrections || [],
    artefacts: {
      paths: artefacts,
      hashes: artefactHashes,
    },
  };
}

/**
 * Writes the experiment manifest to a JSON file.
 *
 * @param {object} manifest - Manifest object from buildExperimentManifest
 * @param {string} outputPath - Destination file path
 * @returns {string} The resolved output path
 */
function writeExperimentManifest(manifest, outputPath) {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return path.resolve(outputPath);
}

/**
 * Loads and parses an experiment manifest from disk.
 *
 * @param {string} manifestPath
 * @returns {object|null}
 */
function loadExperimentManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

/**
 * Appends an iteration entry to the experiment history file.
 *
 * @param {string} historyPath - Path to history JSONL file
 * @param {{ iterationId: string, scoreGlobal: number, scoreDelta: number|null, generatedAt: string }} entry
 */
function appendHistoryEntry(historyPath, entry) {
  const dir = path.dirname(historyPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(historyPath, JSON.stringify(entry) + '\n', 'utf-8');
}

/**
 * Reads all entries from the experiment history JSONL file.
 *
 * @param {string} historyPath
 * @returns {Array<object>}
 */
function readHistory(historyPath) {
  if (!fs.existsSync(historyPath)) return [];
  return fs
    .readFileSync(historyPath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

module.exports = {
  buildExperimentManifest,
  writeExperimentManifest,
  loadExperimentManifest,
  appendHistoryEntry,
  readHistory,
  MANIFEST_VERSION,
};
