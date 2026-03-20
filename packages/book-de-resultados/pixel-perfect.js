'use strict';

/**
 * pixel-perfect.js — Iterative Figma → HTML comparison pipeline
 *
 * Pipeline:
 *   1. Regenera HTML a partir do XLSX real (usa tokens do theme.tokens.yaml)
 *   2. Captura screenshots das páginas escola e escola_disciplinas via Playwright
 *   3. Gera HTML de comparação side-by-side com referências do Figma
 *   4. Abre no browser para inspeção visual
 *
 * Uso:
 *   node pixel-perfect.js                    # Captura + compara
 *   node pixel-perfect.js --watch            # Watch mode: recaptura ao mudar tokens
 *   node pixel-perfect.js --pages escola     # Só captura a página escola
 *   node pixel-perfect.js --open             # Abre a comparação no browser
 *
 * Referências Figma:
 *   escola:              node-id=7457-123
 *   escola_disciplinas:  node-id=7463-2
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFile } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(ROOT, '.pixel-perfect');
const FIGMA_REF_DIR = path.join(OUTPUT_DIR, 'figma-refs');
const CAPTURE_DIR = path.join(OUTPUT_DIR, 'captures');
const COMPARE_HTML = path.join(OUTPUT_DIR, 'compare.html');
const XLSX_PATH = path.join(WORKSPACE_ROOT, 'tests', 'book-de-resultados', 'fixtures', 'canoas-2025-sem2', '[CANOAS 2025 - 2 Semestre] Proficiência por escola.xlsx');

const PAGE_TARGETS = {
  escola: {
    label: 'Escola — School Summary',
    figmaNode: '7457:123',
    // CSS class that identifies the page in the print HTML
    sectionClass: 'section-escola',
    // Exclude escola_disciplinas
    excludeClass: 'section-escola_disciplinas',
    pageIndex: null, // auto-detect first match
  },
  escola_disciplinas: {
    label: 'Escola Disciplinas — Proficiência e Habilidades',
    figmaNode: '7463:2',
    sectionClass: 'section-escola_disciplinas',
    excludeClass: null,
    pageIndex: null,
  },
};

const PAPER = { width: 250, height: 210 }; // mm — landscape
const SCALE = 2; // 2× for retina-quality comparison

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome/Edge não encontrado. Defina CHROME_PATH.');
}

// ── Step 1: Regenerate HTML ───────────────────────────────────────────────────

async function regenerateHtml() {
  console.log('⏳ [1/4] Regenerando HTML a partir dos tokens atuais...');

  const { generateBook } = require('./src/index.js');

  const result = await generateBook({
    inputFile: XLSX_PATH,
    outputDir: ROOT,
    format: 'pdf',
    version: 'v1',
    keepHtml: true,
  }).catch(() => null);

  // Even if PDF fails (no headless browser), keepHtml should have created the .print.html
  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.print.html') && !f.includes('manual'));
  if (htmlFiles.length === 0) {
    throw new Error('Nenhum .print.html gerado. Verifique o pipeline.');
  }

  const htmlPath = path.join(ROOT, htmlFiles[0]);
  console.log(`   ✓ HTML: ${path.basename(htmlPath)}`);
  return htmlPath;
}

// ── Step 2: Capture page screenshots ──────────────────────────────────────────

async function capturePages(htmlPath, targetPages) {
  console.log('⏳ [2/4] Capturando screenshots das páginas...');

  const browser = findBrowser();
  const { chromium } = require('playwright');

  const browserInstance = await chromium.launch({
    executablePath: browser,
    headless: true,
  });

  const context = await browserInstance.newContext({
    viewport: {
      width: Math.round(PAPER.width * 3.7795275591 * SCALE), // mm to px at 96dpi × scale
      height: Math.round(PAPER.height * 3.7795275591 * SCALE),
    },
    deviceScaleFactor: SCALE,
  });

  const page = await context.newPage();
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Wait for fonts and images to load
  await page.waitForTimeout(2000);

  const captures = {};

  for (const [key, target] of Object.entries(targetPages)) {
    // Find the page section in the HTML
    let selector = `.${target.sectionClass}`;
    if (target.excludeClass) {
      selector = `.${target.sectionClass}:not(.${target.excludeClass})`;
    }

    const elements = await page.$$(selector);
    if (elements.length === 0) {
      console.log(`   ⚠ ${key}: nenhum elemento encontrado com ${selector}`);
      continue;
    }

    // Capture first matching page
    const element = elements[0];
    const outPath = path.join(CAPTURE_DIR, `${key}.png`);
    await element.screenshot({ path: outPath, type: 'png' });

    captures[key] = outPath;
    console.log(`   ✓ ${key}: ${path.basename(outPath)} (${elements.length} página(s) encontrada(s))`);
  }

  await browserInstance.close();
  return captures;
}

// ── Step 3: Generate comparison HTML ──────────────────────────────────────────

function generateComparisonHtml(captures, targetPages) {
  console.log('⏳ [3/4] Gerando HTML de comparação...');

  const panels = Object.entries(captures).map(([key, capturePath]) => {
    const target = targetPages[key];
    const captureBase64 = fs.readFileSync(capturePath).toString('base64');
    const figmaRefPath = path.join(FIGMA_REF_DIR, `${key}.png`);
    const hasFigmaRef = fs.existsSync(figmaRefPath);
    const figmaBase64 = hasFigmaRef ? fs.readFileSync(figmaRefPath).toString('base64') : null;

    return `
      <section class="compare-panel" data-page="${key}">
        <h2>${target.label} <small>Figma: ${target.figmaNode}</small></h2>
        <div class="compare-row">
          <div class="compare-col">
            <h3>Figma Reference</h3>
            ${figmaBase64
    ? `<img src="data:image/png;base64,${figmaBase64}" class="compare-img" />`
    : `<div class="placeholder">
                  <p>📎 Coloque o screenshot do Figma em:</p>
                  <code>.pixel-perfect/figma-refs/${key}.png</code>
                  <p>Depois re-execute: <code>node pixel-perfect.js</code></p>
                </div>`
}
          </div>
          <div class="compare-col">
            <h3>HTML Render (atual)</h3>
            <img src="data:image/png;base64,${captureBase64}" class="compare-img" />
          </div>
          ${figmaBase64 ? `
          <div class="compare-col compare-overlay">
            <h3>Overlay (diff visual)</h3>
            <div class="overlay-container">
              <img src="data:image/png;base64,${figmaBase64}" class="overlay-bottom" />
              <img src="data:image/png;base64,${captureBase64}" class="overlay-top" />
              <input type="range" min="0" max="100" value="50" class="opacity-slider"
                oninput="this.previousElementSibling.style.opacity = this.value/100" />
            </div>
          </div>` : ''}
        </div>
      </section>
    `;
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Pixel Perfect — Figma vs HTML</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 24px; }
    h1 { text-align: center; margin-bottom: 8px; font-size: 24px; color: #fff; }
    .subtitle { text-align: center; color: #888; margin-bottom: 32px; font-size: 13px; }
    .token-file { text-align: center; margin-bottom: 24px; }
    .token-file code { background: #2a2a4a; padding: 4px 12px; border-radius: 4px; color: #00A59F; font-size: 12px; }
    .compare-panel { margin-bottom: 48px; border: 1px solid #333; border-radius: 8px; padding: 20px; background: #16213e; }
    .compare-panel h2 { margin-bottom: 16px; font-size: 16px; color: #FFB637; }
    .compare-panel h2 small { color: #666; font-weight: 400; font-size: 12px; margin-left: 8px; }
    .compare-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .compare-col { flex: 1; min-width: 300px; }
    .compare-col h3 { margin-bottom: 8px; font-size: 13px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; }
    .compare-img { width: 100%; border: 1px solid #333; border-radius: 4px; background: #fff; }
    .placeholder { background: #2a2a4a; border: 2px dashed #444; border-radius: 8px; padding: 40px; text-align: center; color: #888; }
    .placeholder code { display: block; margin: 12px 0; color: #00A59F; font-size: 12px; }
    .overlay-container { position: relative; }
    .overlay-bottom, .overlay-top { width: 100%; border: 1px solid #333; border-radius: 4px; }
    .overlay-top { position: absolute; top: 0; left: 0; opacity: 0.5; mix-blend-mode: difference; }
    .opacity-slider { width: 100%; margin-top: 8px; accent-color: #00A59F; }
    .compare-overlay { min-width: 300px; }
    .timestamp { text-align: center; color: #555; font-size: 11px; margin-top: 32px; }
    .hotkeys { text-align: center; color: #666; font-size: 12px; margin-top: 16px; }
    .hotkeys kbd { background: #2a2a4a; padding: 2px 6px; border-radius: 3px; border: 1px solid #444; font-size: 11px; }
  </style>
</head>
<body>
  <h1>🎯 Pixel Perfect — Figma vs HTML Render</h1>
  <p class="subtitle">Ajuste os tokens no YAML, re-execute o script, e compare até ficar idêntico.</p>
  <div class="token-file">
    <code>config/theme.tokens.yaml</code> → <code>node pixel-perfect.js</code> → compare → repeat
  </div>

  ${panels.join('\n')}

  <div class="hotkeys">
    Pipeline: editar <kbd>theme.tokens.yaml</kbd> → <kbd>node pixel-perfect.js</kbd> → verificar overlay → repeat
  </div>
  <div class="timestamp">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
</body>
</html>`;

  fs.writeFileSync(COMPARE_HTML, html, 'utf-8');
  console.log(`   ✓ Comparação: ${path.relative(WORKSPACE_ROOT, COMPARE_HTML)}`);
  return COMPARE_HTML;
}

// ── Step 4: Open in browser ───────────────────────────────────────────────────

function openInBrowser(htmlPath) {
  console.log('⏳ [4/4] Abrindo comparação no browser...');
  const { exec } = require('child_process');
  exec(`start "" "${htmlPath}"`, (err) => {
    if (err) console.log('   ⚠ Não foi possível abrir automaticamente. Abra manualmente:', htmlPath);
    else console.log('   ✓ Aberto no browser padrão');
  });
}

// ── Watch mode ────────────────────────────────────────────────────────────────

function watchTokens(callback) {
  const tokensFile = path.join(ROOT, 'config', 'theme.tokens.yaml');
  const designTokensFile = path.join(ROOT, 'config', 'design-tokens.json');

  console.log('\n👁  Watch mode: observando mudanças em tokens...');
  console.log(`   ${path.relative(WORKSPACE_ROOT, tokensFile)}`);
  console.log(`   ${path.relative(WORKSPACE_ROOT, designTokensFile)}`);
  console.log('   Ctrl+C para sair\n');

  let debounce = null;
  const watcher = (eventType, filename) => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log(`\n🔄 Detectada mudança em ${filename}. Re-executando pipeline...`);
      // Clear require cache for theme module
      Object.keys(require.cache)
        .filter((k) => k.includes('theme') || k.includes('html-renderer') || k.includes('index'))
        .forEach((k) => delete require.cache[k]);
      callback();
    }, 500);
  };

  fs.watch(tokensFile, watcher);
  if (fs.existsSync(designTokensFile)) fs.watch(designTokensFile, watcher);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const shouldWatch = args.includes('--watch') || args.includes('-w');
  const shouldOpen = args.includes('--open') || args.includes('-o');
  const filterPages = args.find((a) => a.startsWith('--pages='));
  const selectedPages = filterPages
    ? filterPages.split('=')[1].split(',').reduce((acc, k) => {
      if (PAGE_TARGETS[k.trim()]) acc[k.trim()] = PAGE_TARGETS[k.trim()];
      return acc;
    }, {})
    : PAGE_TARGETS;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' 🎯 Pixel Perfect Pipeline — Book de Resultados');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  ensureDir(OUTPUT_DIR);
  ensureDir(FIGMA_REF_DIR);
  ensureDir(CAPTURE_DIR);

  // Check for Figma reference images
  const hasFigmaRefs = Object.keys(selectedPages).some((k) =>
    fs.existsSync(path.join(FIGMA_REF_DIR, `${k}.png`)),
  );

  if (!hasFigmaRefs) {
    console.log('\n📎 Dica: Coloque screenshots do Figma em:');
    for (const key of Object.keys(selectedPages)) {
      console.log(`   .pixel-perfect/figma-refs/${key}.png`);
    }
    console.log('   Isso habilita o overlay de comparação visual.\n');
  }

  async function runPipeline() {
    try {
      const htmlPath = await regenerateHtml();
      const captures = await capturePages(htmlPath, selectedPages);
      const comparePath = generateComparisonHtml(captures, selectedPages);

      console.log('\n✅ Pipeline concluído!');
      console.log(`   Comparação: ${path.relative(WORKSPACE_ROOT, comparePath)}`);
      console.log(`   Capturas:   ${path.relative(WORKSPACE_ROOT, CAPTURE_DIR)}/`);

      if (shouldOpen || !shouldWatch) {
        openInBrowser(comparePath);
      }
    } catch (err) {
      console.error('\n❌ Erro no pipeline:', err.message);
      if (err.stack) console.error(err.stack);
    }
  }

  await runPipeline();

  if (shouldWatch) {
    watchTokens(() => runPipeline());
  }
}

main();
