#!/usr/bin/env node
'use strict';

/**
 * capture-page.js — Visual Clone Experiment
 *
 * Captures a deterministic screenshot of the target HTML page using Playwright.
 *
 * Usage:
 *   node capture-page.js --html <path-to-print.html> --out <output-dir> [options]
 *
 * Options:
 *   --html        Path to the .print.html file to capture
 *   --out         Output directory for the screenshot PNG
 *   --selector    CSS selector for the target page (default: .section-visao_geral)
 *   --viewport    Viewport dimensions as WxH (default: 1240x1754)
 *   --scale       Device scale factor (default: 2)
 *   --timeout     Page load timeout in ms (default: 10000)
 *   --filename    Output filename (default: render-current.png)
 *
 * The script:
 *   1. Opens the HTML file in a headless Chromium instance via Playwright
 *   2. Waits for fonts and layout to stabilize
 *   3. Captures a full-page screenshot of the target section at fixed viewport
 *   4. Saves the PNG to the output directory
 *   5. Emits a JSON metadata file alongside the PNG
 *
 * Per Section 8.1 and 9.4 of the experiment specification.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Defaults
const DEFAULT_VIEWPORT = { width: 1240, height: 1754 };
const DEFAULT_SCALE = 2;
const DEFAULT_SELECTOR = '.section-visao_geral';
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_FILENAME = 'render-current.png';

/**
 * Parses CLI arguments into an options object.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--html') opts.htmlPath = args[++i];
    else if (arg === '--out') opts.outputDir = args[++i];
    else if (arg === '--selector') opts.selector = args[++i];
    else if (arg === '--viewport') {
      const [w, h] = args[++i].split('x').map(Number);
      opts.viewport = { width: w, height: h };
    } else if (arg === '--scale') {
      opts.deviceScaleFactor = Number(args[++i]);
    } else if (arg === '--timeout') {
      opts.timeout = Number(args[++i]);
    } else if (arg === '--filename') {
      opts.filename = args[++i];
    }
  }

  return opts;
}

/**
 * Captures the target page section as a PNG screenshot.
 *
 * @param {{
 *   htmlPath: string,
 *   outputDir: string,
 *   selector?: string,
 *   viewport?: { width: number, height: number },
 *   deviceScaleFactor?: number,
 *   timeout?: number,
 *   filename?: string,
 * }} opts
 * @returns {Promise<{ pngPath: string, metaPath: string, meta: object }>}
 */
async function capturePage(opts) {
  const { chromium } = require('playwright');

  const htmlPath = path.resolve(opts.htmlPath);
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}`);
  }

  const outputDir = path.resolve(opts.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const viewport = opts.viewport || DEFAULT_VIEWPORT;
  const deviceScaleFactor = opts.deviceScaleFactor || DEFAULT_SCALE;
  const selector = opts.selector || DEFAULT_SELECTOR;
  const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const filename = opts.filename || DEFAULT_FILENAME;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    // Block external resources for deterministic capture (Section 13.6)
    extraHTTPHeaders: {},
  });

  const page = await context.newPage();

  // Block external network requests to ensure deterministic capture
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://') || url.startsWith('data:')) {
      route.continue();
    } else {
      route.abort();
    }
  });

  const fileUrl = pathToFileURL(htmlPath).href;
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout });

  // Freeze animations and wait for fonts (Section 13.4 — stability mitigation)
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });

  await page.evaluate(() => document.fonts.ready);

  // Locate target section
  const targetElement = await page.$(selector);
  if (!targetElement) {
    await browser.close();
    throw new Error(`Target selector not found in HTML: ${selector}`);
  }

  const pngPath = path.join(outputDir, filename);
  await targetElement.screenshot({ path: pngPath, type: 'png' });

  // Collect layout block metadata for layout scoring
  const domBlocks = await collectDomBlocks(page, selector);

  await browser.close();

  const meta = {
    capturedAt: new Date().toISOString(),
    htmlPath,
    fileUrl,
    selector,
    viewport,
    deviceScaleFactor,
    pngPath,
    domBlocks,
  };

  const metaPath = path.join(outputDir, filename.replace(/\.png$/, '.meta.json'));
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  return { pngPath, metaPath, meta };
}

/**
 * Collects bounding box data for key DOM blocks within the target section.
 * Returns relative coordinates (as fraction of target section bounding box).
 *
 * @param {import('playwright').Page} page
 * @param {string} parentSelector
 * @returns {Promise<Array<{id: string, rect: {x, y, width, height}}>>}
 */
async function collectDomBlocks(page, parentSelector) {
  return page.evaluate((sel) => {
    const parent = document.querySelector(sel);
    if (!parent) return [];

    const parentBox = parent.getBoundingClientRect();
    const pW = parentBox.width || 1;
    const pH = parentBox.height || 1;

    const BLOCK_SELECTORS = [
      { id: 'hero-analitico', selector: '.hero-panel-overview, .hero-panel-main, .analytic-hero' },
      { id: 'grade-indicadores', selector: '.overview-indicator-grid, .indicator-grid' },
      { id: 'painel-distribuicao', selector: '.priority-template, .distribuicao-panel' },
      { id: 'callout-institucional', selector: '.summary-callout, .institutional-callout' },
      { id: 'painel-proficiencia', selector: '.proficiencia-chart, .proficiency-panel' },
      { id: 'painel-resumo-disciplina', selector: '.medias-disciplinas, .discipline-summary' },
      { id: 'rodape-paginacao', selector: '.page-footer, .pagination-badge' },
    ];

    return BLOCK_SELECTORS
      .map(({ id, selector: blockSel }) => {
        const el = parent.querySelector(blockSel);
        if (!el) return null;
        const box = el.getBoundingClientRect();
        return {
          id,
          rect: {
            x: (box.left - parentBox.left) / pW,
            y: (box.top - parentBox.top) / pH,
            width: box.width / pW,
            height: box.height / pH,
          },
        };
      })
      .filter(Boolean);
  }, parentSelector);
}

// CLI entrypoint
if (require.main === module) {
  const opts = parseArgs(process.argv);

  if (!opts.htmlPath || !opts.outputDir) {
    console.error('Usage: node capture-page.js --html <path> --out <dir> [--selector <css>] [--viewport WxH] [--scale N] [--timeout N] [--filename name.png]');
    process.exit(1);
  }

  capturePage(opts)
    .then(({ pngPath, metaPath }) => {
      console.log(`Screenshot saved: ${pngPath}`);
      console.log(`Metadata saved:   ${metaPath}`);
    })
    .catch((err) => {
      console.error('Capture failed:', err.message);
      process.exit(1);
    });
}

module.exports = { capturePage, collectDomBlocks };
