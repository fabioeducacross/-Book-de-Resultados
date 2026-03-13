#!/usr/bin/env node
'use strict';

/**
 * run-experiment.js — Visual Clone Experiment
 *
 * Orchestrates the full visual clone experiment pipeline for the Visão Geral da Rede page.
 *
 * Pipeline (per Section 7.3 of the experiment specification):
 *   1. Extract reference page from PDF using PyMuPDF (extract-reference.py)
 *   2. Capture the rendered HTML page using Playwright (capture-page.js)
 *   3. Normalise image dimensions
 *   4. Run the visual evaluation algorithm (evaluate-visual.js)
 *   5. Build the experiment manifest (experiment-manifest.js)
 *   6. Save all artefacts to the runtime output directory
 *   7. Print score summary and prioritised corrections
 *
 * Usage:
 *   node run-experiment.js [options]
 *
 * Options:
 *   --html        Path to the .print.html file (required)
 *   --pdf         Path to the PDF reference file (required)
 *   --pdf-page    Zero-based page index in the PDF (default: auto-detect or 0)
 *   --out         Base output directory (default: examples/.runtime/visual-clone-experiment)
 *   --iteration   Iteration ID (default: timestamp-based)
 *   --dpi         DPI for PDF rasterisation (default: 150)
 *   --viewport    Viewport for HTML capture as WxH (default: 1240x1754)
 *   --scale       Device scale factor (default: 2)
 *   --baseline    If set, saves result as the experiment baseline
 *
 * Output artefacts (per Section 11.2):
 *   {out}/current/reference-page.png
 *   {out}/current/render-current.png
 *   {out}/diff/diff-global.png
 *   {out}/metrics/metrics-{iteration}.json
 *   {out}/history/history.jsonl
 *   {out}/manifest-{iteration}.json
 *
 * If --baseline is set, copies current artefacts to {out}/baseline/.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { PNG } = require('pngjs');

const { evaluateVisual, rankCorrections } = require('./evaluate-visual');
const { getVisaoGeralRegions } = require('./regions');
const {
  buildExperimentManifest,
  writeExperimentManifest,
  loadExperimentManifest,
  appendHistoryEntry,
} = require('./experiment-manifest');

const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_OUT = path.join(PACKAGE_ROOT, 'examples', '.runtime', 'visual-clone-experiment');
const DEFAULT_VIEWPORT = { width: 1240, height: 1754 };
const DEFAULT_DPI = 150;
const DEFAULT_SCALE = 2;

/**
 * Parses CLI arguments.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    htmlPath: null,
    pdfPath: null,
    pdfPageIndex: 0,
    outputDir: DEFAULT_OUT,
    iterationId: `iter-${Date.now()}`,
    dpi: DEFAULT_DPI,
    viewport: DEFAULT_VIEWPORT,
    deviceScaleFactor: DEFAULT_SCALE,
    saveBaseline: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--html') opts.htmlPath = args[++i];
    else if (arg === '--pdf') opts.pdfPath = args[++i];
    else if (arg === '--pdf-page') opts.pdfPageIndex = Number(args[++i]);
    else if (arg === '--out') opts.outputDir = args[++i];
    else if (arg === '--iteration') opts.iterationId = args[++i];
    else if (arg === '--dpi') opts.dpi = Number(args[++i]);
    else if (arg === '--viewport') {
      const [w, h] = args[++i].split('x').map(Number);
      opts.viewport = { width: w, height: h };
    } else if (arg === '--scale') {
      opts.deviceScaleFactor = Number(args[++i]);
    } else if (arg === '--baseline') {
      opts.saveBaseline = true;
    }
  }

  return opts;
}

/**
 * Runs the extract-reference.py script via Python.
 *
 * @param {{ pdfPath: string, pageIndex: number, outputDir: string, dpi: number }} params
 * @returns {Promise<string>} Path to the output PNG
 */
function extractReference({ pdfPath, pageIndex, outputDir, dpi }) {
  const scriptPath = path.join(__dirname, 'extract-reference.py');
  const args = [
    scriptPath,
    '--pdf', pdfPath,
    '--page', String(pageIndex),
    '--out', outputDir,
    '--dpi', String(dpi),
    '--filename', 'reference-page.png',
  ];

  return new Promise((resolve, reject) => {
    const python = process.platform === 'win32' ? 'python' : 'python3';
    execFile(python, args, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`extract-reference.py failed: ${stderr || stdout || err.message}`));
        return;
      }
      const pngPath = path.join(outputDir, 'reference-page.png');
      resolve(pngPath);
    });
  });
}

/**
 * Normalises two PNG buffers to the same pixel dimensions by cropping to minimum overlap.
 *
 * @param {Buffer} refBuf
 * @param {Buffer} renderBuf
 * @returns {{ ref: Buffer, render: Buffer, width: number, height: number }}
 */
function normalisePngs(refBuf, renderBuf) {
  const refPng = PNG.sync.read(refBuf);
  const renderPng = PNG.sync.read(renderBuf);

  const width = Math.min(refPng.width, renderPng.width);
  const height = Math.min(refPng.height, renderPng.height);

  function cropPng(png, w, h) {
    if (png.width === w && png.height === h) {
      return Buffer.from(png.data);
    }
    const out = Buffer.alloc(w * h * 4);
    for (let row = 0; row < h; row++) {
      const srcOff = row * png.width * 4;
      const dstOff = row * w * 4;
      png.data.copy(out, dstOff, srcOff, srcOff + w * 4);
    }
    return out;
  }

  return {
    ref: cropPng(refPng, width, height),
    render: cropPng(renderPng, width, height),
    width,
    height,
  };
}

/**
 * Saves a diff PNG buffer to disk.
 *
 * @param {Buffer} diffData - Raw RGBA pixel buffer
 * @param {number} width
 * @param {number} height
 * @param {string} outputPath
 */
function saveDiffPng(diffData, width, height, outputPath) {
  const png = new PNG({ width, height });
  diffData.copy(png.data);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, PNG.sync.write(png));
}

/**
 * Runs the full visual clone experiment pipeline.
 *
 * @param {object} opts - Options from parseArgs
 */
async function runExperiment(opts) {
  const {
    htmlPath,
    pdfPath,
    pdfPageIndex,
    outputDir,
    iterationId,
    dpi,
    viewport,
    deviceScaleFactor,
    saveBaseline,
  } = opts;

  // --- Validate inputs ---
  if (!htmlPath || !fs.existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}`);
  }
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const currentDir = path.join(outputDir, 'current');
  const diffDir = path.join(outputDir, 'diff');
  const metricsDir = path.join(outputDir, 'metrics');
  const historyDir = path.join(outputDir, 'history');

  fs.mkdirSync(currentDir, { recursive: true });
  fs.mkdirSync(diffDir, { recursive: true });
  fs.mkdirSync(metricsDir, { recursive: true });
  fs.mkdirSync(historyDir, { recursive: true });

  console.log(`\n[1/5] Extracting PDF reference (page ${pdfPageIndex}, ${dpi} DPI)...`);
  const referencePngPath = await extractReference({
    pdfPath: path.resolve(pdfPath),
    pageIndex: pdfPageIndex,
    outputDir: currentDir,
    dpi,
  });
  console.log(`      Reference PNG: ${referencePngPath}`);

  console.log('\n[2/5] Capturing HTML render with Playwright...');
  const { capturePage } = require('./capture-page');
  const captureResult = await capturePage({
    htmlPath: path.resolve(htmlPath),
    outputDir: currentDir,
    viewport,
    deviceScaleFactor,
    filename: 'render-current.png',
  });
  const renderPngPath = captureResult.pngPath;
  const domBlocks = captureResult.meta.domBlocks || [];
  console.log(`      Render PNG: ${renderPngPath}`);

  console.log('\n[3/5] Normalising images...');
  const refBuf = fs.readFileSync(referencePngPath);
  const renderBuf = fs.readFileSync(renderPngPath);
  const { width, height } = normalisePngs(refBuf, renderBuf);
  console.log(`      Normalised dimensions: ${width}×${height} px`);

  console.log('\n[4/5] Running visual evaluation...');
  const regions = getVisaoGeralRegions();

  // Build expected block layout from region definitions (used as expected anchors)
  const expectedBlocks = regions.map((r) => ({ id: r.id, rect: r.rect }));

  // Build actual blocks from DOM measurements
  const actualBlocks = domBlocks.map((b) => ({ id: b.id, rect: b.rect }));

  const evalResult = evaluateVisual(refBuf, renderBuf, {
    regions,
    layoutBlocks: { expected: expectedBlocks, actual: actualBlocks },
  });
  const corrections = rankCorrections(evalResult);

  console.log(`\n      Score global:  ${evalResult.scoreGlobal}`);
  console.log(`      S_pixel:       ${evalResult.components.pixel}`);
  console.log(`      S_ssim:        ${evalResult.components.ssim}`);
  console.log(`      S_layout:      ${evalResult.components.layout}`);
  console.log(`      Pixel drift:   ${Math.round(evalResult.global.pixelDiffRatio * 100)}%`);

  // Save diff image
  const diffPngPath = path.join(diffDir, `diff-${iterationId}.png`);
  saveDiffPng(evalResult.diffBuffer, evalResult.dimensions.width, evalResult.dimensions.height, diffPngPath);
  console.log(`      Diff PNG:      ${diffPngPath}`);

  // Save metrics JSON
  const metricsPath = path.join(metricsDir, `metrics-${iterationId}.json`);
  fs.writeFileSync(metricsPath, JSON.stringify({
    iterationId,
    generatedAt: new Date().toISOString(),
    scoreGlobal: evalResult.scoreGlobal,
    components: evalResult.components,
    global: evalResult.global,
    regions: evalResult.regions,
    divergences: evalResult.divergences,
    layout: evalResult.layout,
    corrections,
  }, null, 2));

  console.log('\n[5/5] Building experiment manifest...');

  // Load previous score from history
  const historyPath = path.join(historyDir, 'history.jsonl');
  const historyEntries = fs.existsSync(historyPath)
    ? fs.readFileSync(historyPath, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const previousScore = historyEntries.length > 0
    ? historyEntries[historyEntries.length - 1].scoreGlobal
    : null;

  const manifest = buildExperimentManifest({
    iterationId,
    referenceParams: {
      pdfPath: path.resolve(pdfPath),
      pageIndex: pdfPageIndex,
      dpi,
    },
    captureParams: {
      htmlPath: path.resolve(htmlPath),
      viewport,
      deviceScaleFactor,
    },
    evalResult,
    corrections,
    artefacts: {
      referencePng: referencePngPath,
      renderPng: renderPngPath,
      diffPng: diffPngPath,
      metricsJson: metricsPath,
    },
    previousScore,
  });

  const manifestPath = path.join(outputDir, `manifest-${iterationId}.json`);
  writeExperimentManifest(manifest, manifestPath);
  console.log(`      Manifest: ${manifestPath}`);

  // Append to history
  appendHistoryEntry(historyPath, {
    iterationId,
    scoreGlobal: evalResult.scoreGlobal,
    scoreDelta: manifest.results.scoreDelta,
    generatedAt: manifest.generatedAt,
  });

  // Optionally save as baseline
  if (saveBaseline) {
    const baselineDir = path.join(outputDir, 'baseline');
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.copyFileSync(referencePngPath, path.join(baselineDir, 'reference-baseline.png'));
    fs.copyFileSync(renderPngPath, path.join(baselineDir, 'render-baseline.png'));
    writeExperimentManifest(manifest, path.join(baselineDir, 'manifest-baseline.json'));
    console.log(`      Baseline saved: ${baselineDir}`);
  }

  // --- Summary ---
  console.log('\n══════════════════════════════════════════════════');
  console.log(` Visual Clone Experiment — ${iterationId}`);
  console.log('══════════════════════════════════════════════════');
  console.log(` Score global:  ${evalResult.scoreGlobal}  (target: ≥ 0.90)`);
  console.log(` S_pixel:       ${evalResult.components.pixel}`);
  console.log(` S_ssim:        ${evalResult.components.ssim}`);
  console.log(` S_layout:      ${evalResult.components.layout}  (target: ≥ 0.92)`);
  console.log(` Pixel drift:   ${Math.round(evalResult.global.pixelDiffRatio * 100)}%  (target: < 12%)`);
  if (manifest.results.scoreDelta !== null) {
    const delta = manifest.results.scoreDelta;
    console.log(` Delta vs prev: ${delta >= 0 ? '+' : ''}${delta}`);
  }
  console.log('');

  if (corrections.length > 0) {
    console.log(' Top corrections prioritised by visual impact:');
    corrections.slice(0, 5).forEach((c) => {
      console.log(`   [${c.priority}] ${c.action} — ${c.expectedGain}`);
    });
  }

  if (manifest.results.thresholdsMet) {
    const t = manifest.results.thresholdsMet;
    const allMet = Object.values(t).every(Boolean);
    console.log('');
    console.log(` Acceptance criteria: ${allMet ? '✓ ALL MET' : '✗ NOT ALL MET'}`);
    if (!allMet) {
      if (!t.globalMin090) console.log('   ✗ Global score < 0.90');
      if (!t.layoutMin092) console.log('   ✗ Layout score < 0.92');
      if (!t.pixelDriftBelow12pct) console.log('   ✗ Pixel drift ≥ 12%');
      if (!t.noCriticalRegionBelow085) console.log('   ✗ One or more critical regions below 0.85');
    }
  }

  console.log('══════════════════════════════════════════════════\n');

  return { manifest, evalResult, corrections };
}

// CLI entrypoint
if (require.main === module) {
  const opts = parseArgs(process.argv);

  if (!opts.htmlPath || !opts.pdfPath) {
    console.error('Usage: node run-experiment.js --html <path> --pdf <path> [options]');
    console.error('       --pdf-page N      Zero-based PDF page index (default: 0)');
    console.error('       --out <dir>       Output directory');
    console.error('       --iteration <id>  Iteration identifier');
    console.error('       --dpi N           PDF rasterisation DPI (default: 150)');
    console.error('       --viewport WxH    Capture viewport (default: 1240x1754)');
    console.error('       --scale N         Device scale factor (default: 2)');
    console.error('       --baseline        Save this run as the baseline');
    process.exit(1);
  }

  runExperiment(opts).catch((err) => {
    console.error('\nExperiment failed:', err.message);
    process.exit(1);
  });
}

module.exports = { runExperiment, normalisePngs, saveDiffPng };
