const fs = require('fs');
const os = require('os');
const path = require('path');

// Mock child_process before importing anything that uses it
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'child_process') {
    return { execFile: () => {} };
  }
  return originalRequire.apply(this, arguments);
};

const { buildCanoasWorkbook } = require('./tests/book-de-resultados/canoas-fixture');
const { parseSpreadsheet } = require('./packages/book-de-resultados/src/parser');
const { validate } = require('./packages/book-de-resultados/src/validator');
const { normalize } = require('./packages/book-de-resultados/src/normalizer');
const { render } = require('./packages/book-de-resultados/src/renderer');
const { generateChartsForPage } = require('./packages/book-de-resultados/src/charts');
const { buildHtmlDocument } = require('./packages/book-de-resultados/src/html-renderer');

(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-split-'));
  const FIXTURE_FILENAME = `[CANOAS 2025 - 2 Semestre] Proficiencia por escola-analyze-${Date.now()}.xlsx`;
  const workbookPath = path.join(tempDir, FIXTURE_FILENAME);

  const workbook = await buildCanoasWorkbook();
  await workbook.xlsx.writeFile(workbookPath);

  const parsed = await parseSpreadsheet(workbookPath);
  const validated = validate(parsed);
  const metrics = normalize(parsed);
  const pages = render(metrics);
  const chartsPerPage = pages.map((page) => generateChartsForPage(page));

  const html = buildHtmlDocument(pages, chartsPerPage, metrics, {});

  // Find ALL analytic-split occurrences
  const allSplits = html.match(/class="analytic-split"/g) || [];
  console.log('\n=== ALL ANALYTIC-SPLIT OCCURRENCES ===\n');
  console.log(`Total count: ${allSplits.length}\n`);

  // Match each one with its section and layout
  const splitRegex = /class="analytic-split"([^>]*)>/g;
  const splitMatches = [];
  let splitMatch;
  while ((splitMatch = splitRegex.exec(html)) !== null) {
    const layoutAttr = splitMatch[1].match(/data-layout="([^"]+)"/) ? splitMatch[1].match(/data-layout="([^"]+)"/)[1] : '';
    
    // Find which section this is in
    const beforeText = html.substring(0, splitMatch.index);
    const sectionMatch = beforeText.match(/section class="([^"]*\bpage\b[^"]*)"[^>]*>/g);
    const lastSection = sectionMatch ? sectionMatch[sectionMatch.length - 1] : '';
    const sectionType = lastSection.match(/section-([a-z_]+)/) ? lastSection.match(/section-([a-z_]+)/)[1] : 'unknown';
    
    splitMatches.push({ section: sectionType, layout: layoutAttr || '(no layout)' });
  }

  // Group by section
  const bySectionAndLayout = {};
  splitMatches.forEach(m => {
    const key = `${m.section}|${m.layout}`;
    bySectionAndLayout[key] = (bySectionAndLayout[key] || 0) + 1;
  });

  console.log('By Section → Layout:');
  Object.entries(bySectionAndLayout).forEach(([key, count]) => {
    const [section, layout] = key.split('|');
    console.log(`  [${section}] + "${layout}": ${count} instance(s)`);
  });

  // Also check for priority template shells
  const shellRegex = /data-layout="([^"]+)"/g;
  const shellMatches = html.match(shellRegex) || [];
  const shells = {};
  shellMatches.forEach(m => {
    const layout = m.match(/data-layout="([^"]+)"/)[1];
    shells[layout] = (shells[layout] || 0) + 1;
  });

  console.log('\n=== DATA-LAYOUT SHELLS ===\n');
  Object.entries(shells).forEach(([layout, count]) => {
    console.log(`  ${layout}: ${count} instance(s)`);
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
})();
