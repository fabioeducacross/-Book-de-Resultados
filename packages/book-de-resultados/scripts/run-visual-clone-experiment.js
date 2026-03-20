'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');
const { parseSpreadsheet } = require('../src/parser');
const { validate } = require('../src/validator');
const { normalize } = require('../src/normalizer');
const { render } = require('../src/renderer');
const { generateChartsForPage } = require('../src/charts');
const { buildHtmlDocument } = require('../src/html-renderer');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CONFIG_PATH = path.resolve(__dirname, '..', 'reference', 'visual-clone', 'visao-geral-da-rede.config.json');
const PYTHON_SCRIPT = path.resolve(__dirname, 'score-visual-clone.py');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveWorkspacePath(relativePath) {
  return path.resolve(ROOT, relativePath);
}

function findFixtureWorkbook(fixtureDir) {
  const files = fs.readdirSync(fixtureDir);
  const workbook = files.find((file) => file.endsWith('.xlsx'));
  if (!workbook) {
    throw new Error(`Nenhum arquivo XLSX encontrado em ${fixtureDir}`);
  }
  return path.join(fixtureDir, workbook);
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function extractReferencePage(referencePdf, pageNumber, dpi, outputPath) {
  const pythonCode = [
    'import fitz, pathlib, sys',
    'reference_pdf = pathlib.Path(sys.argv[1])',
    'page_number = int(sys.argv[2])',
    'dpi = int(sys.argv[3])',
    'output_path = pathlib.Path(sys.argv[4])',
    'doc = fitz.open(reference_pdf)',
    'page = doc.load_page(page_number - 1)',
    'pix = page.get_pixmap(dpi=dpi, alpha=False)',
    'output_path.parent.mkdir(parents=True, exist_ok=True)',
    'pix.save(str(output_path))',
  ].join('; ');

  const result = spawnSync('python', ['-c', pythonCode, referencePdf, String(pageNumber), String(dpi), outputPath], {
    cwd: ROOT,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Falha ao extrair a página de referência');
  }
}

async function captureCurrentPage(htmlPath, config, outputPath, regionsPath) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: config.capture.viewport,
      deviceScaleFactor: config.capture.deviceScaleFactor || 1,
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await page.addStyleTag({ content: config.capture.disableAnimationCss });
    await page.evaluate(async () => {
      if (globalThis.document?.fonts && globalThis.document.fonts.ready) {
        await globalThis.document.fonts.ready;
      }
    });
    await page.waitForTimeout(config.capture.waitAfterLoadMs || 250);

    const captureData = await page.evaluate(({ pageSelector, regionConfigs }) => {
      const host = globalThis.document.querySelector(pageSelector);
      if (!host) {
        return { error: `Página-alvo não encontrada com selector ${pageSelector}` };
      }

      const hostRect = host.getBoundingClientRect();
      const normalize = (rect) => ({
        x: Number(((rect.x - hostRect.x) / hostRect.width).toFixed(4)),
        y: Number(((rect.y - hostRect.y) / hostRect.height).toFixed(4)),
        width: Number((rect.width / hostRect.width).toFixed(4)),
        height: Number((rect.height / hostRect.height).toFixed(4)),
      });

      const regions = {};
      for (const region of regionConfigs) {
        const target = host.querySelector(region.selector);
        if (!target) {
          continue;
        }
        regions[region.id] = normalize(target.getBoundingClientRect());
      }

      return {
        pageBox: normalize(hostRect),
        regions,
      };
    }, {
      pageSelector: config.capture.pageSelector,
      regionConfigs: config.regions,
    });

    if (captureData.error) {
      throw new Error(captureData.error);
    }

    const locator = page.locator(config.capture.pageSelector).first();
    await locator.screenshot({ path: outputPath });
    writeJson(regionsPath, captureData);
  } finally {
    await browser.close();
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const outputRoot = resolveWorkspacePath(config.outputDir);
  const baselineDir = path.join(outputRoot, 'baseline');
  const currentDir = path.join(outputRoot, 'current');
  const diffDir = path.join(outputRoot, 'diff');
  const metricsDir = path.join(outputRoot, 'metrics');
  const historyDir = path.join(outputRoot, 'history');
  [baselineDir, currentDir, diffDir, metricsDir, historyDir].forEach(ensureDir);

  const fixtureDir = resolveWorkspacePath(config.fixtureDir);
  const workbookPath = findFixtureWorkbook(fixtureDir);
  const referencePdf = resolveWorkspacePath(config.referencePdf);

  const parsed = await parseSpreadsheet(workbookPath);
  const validation = validate(parsed);
  if (!validation.valid) {
    throw new Error(`Validação falhou: ${validation.errors.join('; ')}`);
  }
  const metrics = normalize(parsed);
  const pages = render(metrics);
  const chartsPerPage = pages.map((page) => generateChartsForPage(page));
  const overviewPage = pages.find((page) => page.section === config.page.section);
  if (!overviewPage) {
    throw new Error(`Página da seção ${config.page.section} não encontrada`);
  }

  const htmlFilename = `relatorio_${String(metrics.metadata.municipio || '').toLowerCase().replace(/\s+/g, '_')}_${metrics.metadata.ano}_${metrics.metadata.ciclo}_${config.id}.print.html`;
  const htmlPath = path.join(currentDir, htmlFilename);
  const html = buildHtmlDocument(pages, chartsPerPage, metrics.metadata, {
    htmlOutputPath: htmlPath,
    version: config.id,
  });
  fs.writeFileSync(htmlPath, html, 'utf-8');

  const referenceImage = path.join(baselineDir, `reference-page-${config.page.referencePdfPageNumber}.png`);
  extractReferencePage(referencePdf, config.page.referencePdfPageNumber, config.reference.dpi || 144, referenceImage);

  const currentImage = path.join(currentDir, `current-page-${overviewPage.pageNumber}.png`);
  const currentRegionsFile = path.join(currentDir, 'current-regions.json');
  await captureCurrentPage(htmlPath, config, currentImage, currentRegionsFile);

  const currentRegions = JSON.parse(fs.readFileSync(currentRegionsFile, 'utf-8'));
  const manifest = {
    experimentId: config.id,
    generatedAt: new Date().toISOString(),
    page: {
      section: overviewPage.section,
      title: overviewPage.title,
      currentPageNumber: overviewPage.pageNumber,
      referencePdfPageNumber: config.page.referencePdfPageNumber,
    },
    viewport: config.capture.viewport,
    deviceScaleFactor: config.capture.deviceScaleFactor || 1,
    referenceDpi: config.reference.dpi || 144,
    regions: config.regions,
    currentRegions: currentRegions.regions,
    artifacts: {
      htmlFile: htmlPath,
      referenceImage,
      currentImage,
      diffDir,
      metricsFile: path.join(metricsDir, 'metrics.json'),
      manifestFile: path.join(outputRoot, 'experiment-manifest.json'),
    },
  };
  writeJson(manifest.artifacts.manifestFile, manifest);

  const pythonResult = spawnSync('python', [PYTHON_SCRIPT, manifest.artifacts.manifestFile], {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  if (pythonResult.status !== 0) {
    throw new Error(pythonResult.stderr || pythonResult.stdout || 'Falha ao calcular as métricas do experimento');
  }

  const metricsOutput = JSON.parse(fs.readFileSync(manifest.artifacts.metricsFile, 'utf-8'));
  const historyEntry = {
    generatedAt: manifest.generatedAt,
    finalScore: metricsOutput.global.finalScore,
    weightedPixelScore: metricsOutput.global.weightedPixelScore,
    weightedSsimScore: metricsOutput.global.weightedSsimScore,
    layoutScore: metricsOutput.global.layoutScore,
    page: manifest.page,
  };
  writeJson(path.join(historyDir, `${manifest.generatedAt.replace(/[:.]/g, '-')}.json`), historyEntry);

  console.log(JSON.stringify({
    experimentId: config.id,
    page: manifest.page,
    finalScore: metricsOutput.global.finalScore,
    weightedPixelScore: metricsOutput.global.weightedPixelScore,
    weightedSsimScore: metricsOutput.global.weightedSsimScore,
    layoutScore: metricsOutput.global.layoutScore,
    artifacts: manifest.artifacts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});