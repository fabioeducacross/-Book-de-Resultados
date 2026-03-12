'use strict';

/**
 * Regression Suite — Canoas Avaliação Digital Layout
 * Issue #6: End-to-end regression tests for the Canoas case
 *
 * Validates every pipeline stage against the anonymised fixture in
 * canoas-fixture.js and the structural baseline in canoas-baseline.json:
 *
 *   Stage 1 — Parse        xlsx → canonical contract
 *   Stage 2 — Validate     contract compliance
 *   Stage 3 — Normalize    metrics + canonical v2 model
 *   Stage 4 — Render       pages + section sequence
 *   Stage 5 — Charts       descriptors per page
 *   Stage 6 — Export JSON  file shape & deterministic filename
 *   Stage 7 — Export PDF   mocked browser — CI-safe
 *   Stage 8 — Full pipeline via generateBook() public API
 *
 * CI-safety:
 *   The browser call inside exportPdf() is replaced by a jest.mock on
 *   'child_process'.  No real Chromium / Edge installation is required.
 *
 * Updating the baseline:
 *   UPDATE_BASELINE=1 npx jest tests/book-de-resultados/regression-canoas.test.js
 *   (See packages/book-de-resultados/README.md § Updating the Canoas Regression Baseline)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Mock child_process BEFORE any require that imports it ──────────────────
jest.mock('child_process', () => ({ execFile: jest.fn() }));

const { execFile } = require('child_process');

const { FIXTURE, EXPECTED, buildCanoasWorkbook } = require('./canoas-fixture');
const {
  parseSpreadsheet,
} = require('../../packages/book-de-resultados/src/parser');
const { validate } = require('../../packages/book-de-resultados/src/validator');
const { normalize } = require('../../packages/book-de-resultados/src/normalizer');
const { render } = require('../../packages/book-de-resultados/src/renderer');
const { generateChartsForPage } = require('../../packages/book-de-resultados/src/charts');
const {
  exportJson,
  exportPdf,
} = require('../../packages/book-de-resultados/src/exporter');
const { buildHtmlDocument } = require('../../packages/book-de-resultados/src/html-renderer');
const { generateBook } = require('../../packages/book-de-resultados/src');

// ── Load structural baseline ───────────────────────────────────────────────
const BASELINE_PATH = path.join(__dirname, 'canoas-baseline.json');
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));

// ── Shared temp dir (created once for the whole suite) ────────────────────
let tempDir;
let workbookPath;

// File path pattern mirrors the real Canoas naming convention so that
// inferMetadataFromFilePath() picks up ano='2025' and ciclo='2025-sem2'.
const FIXTURE_FILENAME = `[CANOAS 2025 - 2 Semestre] Proficiencia por escola-regression-${Date.now()}.xlsx`;

// ── Pipeline outputs (populated in beforeAll) ─────────────────────────────
let parsed;
let validated;
let metrics;
let pages;
let chartsPerPage;

function getRenderedPageBlocks(html) {
  return Array.from(
    html.matchAll(
      /<section class="([^"]*\bpage\b[^"]*)"[^>]*>([\s\S]*?)<\/section>\s*(?=<section class="[^"]*\bpage\b[^"]*"[^>]*>|<\/body>)/g,
    ),
  ).map((match) => {
    const className = match[1];
    const sectionMatch = className.match(/\bsection-([a-z_]+)\b/);
    const blockHtml = match[0];
    return {
      className,
      section: sectionMatch ? sectionMatch[1] : '',
      html: blockHtml,
      text: normalizeHtmlText(blockHtml),
    };
  });
}

function normalizeHtmlText(html) {
  return decodeHtmlEntities(String(html))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(value, pattern) {
  const matches = String(value).match(pattern);
  return matches ? matches.length : 0;
}

function findRenderedPage(pageBlocks, section, matcher = null) {
  return pageBlocks.find((pageBlock) => {
    if (pageBlock.section !== section) {
      return false;
    }
    return typeof matcher === 'function' ? matcher(pageBlock) : true;
  });
}

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-regression-canoas-'));
  workbookPath = path.join(tempDir, FIXTURE_FILENAME);

  const workbook = await buildCanoasWorkbook();
  await workbook.xlsx.writeFile(workbookPath);

  // Run the full deterministic pipeline so every stage shares the same data
  parsed = await parseSpreadsheet(workbookPath);
  validated = validate(parsed);
  metrics = normalize(parsed);
  pages = render(metrics);
  chartsPerPage = pages.map((page) => generateChartsForPage(page));
});

afterAll(() => {
  execFile.mockReset();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 1 — PARSE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stage 1 — Parse: xlsx → canonical contract', () => {
  test('detects the Canoas Avaliação Digital layout', () => {
    expect(parsed.source.layout).toBe(EXPECTED.parse.layout);
    expect(parsed.source.layout).toBe(baseline.pipeline.parse.layout);
  });

  test('extracts municipio from the Nome da rede cell (D2)', () => {
    expect(parsed.metadata.municipio).toBe(EXPECTED.parse.municipio);
  });

  test('infers ano and ciclo from the file path pattern', () => {
    expect(parsed.metadata.ano).toBe(EXPECTED.parse.ano);
    expect(parsed.metadata.ciclo).toBe(EXPECTED.parse.ciclo);
  });

  test('produces the correct number of escolas', () => {
    expect(parsed.escolas).toHaveLength(EXPECTED.parse.escolasCount);
    expect(parsed.escolas).toHaveLength(baseline.pipeline.parse.escolasCount);
  });

  test('produces the correct number of resultados rows', () => {
    // 3 schools × 2 disciplines
    expect(parsed.resultados).toHaveLength(EXPECTED.parse.resultadosCount);
  });

  test('produces the correct number of distribuicao rows', () => {
    // 3 schools × 2 disciplines × 4 levels
    expect(parsed.distribuicao).toHaveLength(EXPECTED.parse.distribuicaoCount);
  });

  test('produces the correct number of habilidades rows', () => {
    expect(parsed.habilidades).toHaveLength(EXPECTED.parse.habilidadesCount);
  });

  test('each escola has a non-empty id_escola and nome_escola', () => {
    parsed.escolas.forEach((escola) => {
      expect(escola.id_escola).toBeTruthy();
      expect(escola.nome_escola).toBeTruthy();
    });
  });

  test('school ids are slugified, lower-case, underscore-separated', () => {
    const ids = parsed.escolas.map((e) => e.id_escola);
    ids.forEach((id) => {
      expect(id).toMatch(/^[a-z0-9_]+$/);
    });
  });

  test('resultados have all required canonical fields', () => {
    parsed.resultados.forEach((r) => {
      expect(r).toHaveProperty('id_escola');
      expect(r).toHaveProperty('ano');
      expect(r).toHaveProperty('disciplina');
      expect(r).toHaveProperty('media');
      expect(r).toHaveProperty('participacao');
    });
  });

  test('all resultados have ano = "Geral" (Canoas layout projection)', () => {
    parsed.resultados.forEach((r) => {
      expect(r.ano).toBe('Geral');
    });
  });

  test('disciplines are Matemática and Língua Portuguesa', () => {
    const disciplinas = [...new Set(parsed.resultados.map((r) => r.disciplina))];
    expect(disciplinas).toEqual(expect.arrayContaining(['Matemática', 'Língua Portuguesa']));
    expect(disciplinas).toHaveLength(2);
  });

  test('distribuicao rows have disciplina, nivel and alunos fields', () => {
    parsed.distribuicao.forEach((d) => {
      expect(d).toHaveProperty('disciplina');
      expect(d).toHaveProperty('nivel');
      expect(typeof d.alunos).toBe('number');
    });
  });

  test('distribuicao nivel values are valid canonical levels', () => {
    const validLevels = new Set(['abaixo_do_basico', 'basico', 'adequado', 'avancado']);
    parsed.distribuicao.forEach((d) => {
      expect(validLevels.has(d.nivel)).toBe(true);
    });
  });

  test('deterministic: Escola Alfa / MT / abaixo_do_basico alunos = 19', () => {
    const alfaId = parsed.escolas.find((e) =>
      e.nome_escola.toLowerCase().includes('alfa'),
    )?.id_escola;

    expect(alfaId).toBeTruthy();

    const row = parsed.distribuicao.find(
      (d) => d.id_escola === alfaId && d.disciplina === 'Matemática' && d.nivel === 'abaixo_do_basico',
    );
    expect(row).toBeDefined();
    expect(row.alunos).toBe(EXPECTED.parse.escolaAlfaMtAbaixo);
    expect(row.alunos).toBe(baseline.pipeline.parse.deterministic.escolaAlfaMtAbaixo);
  });

  test('deterministic: Escola Alfa / LP / avancado alunos = 43', () => {
    const alfaId = parsed.escolas.find((e) =>
      e.nome_escola.toLowerCase().includes('alfa'),
    )?.id_escola;

    const row = parsed.distribuicao.find(
      (d) => d.id_escola === alfaId && d.disciplina === 'Língua Portuguesa' && d.nivel === 'avancado',
    );
    expect(row).toBeDefined();
    expect(row.alunos).toBe(EXPECTED.parse.escolaAlfaLpAvancado);
  });

  test('habilidades have all required canonical fields', () => {
    parsed.habilidades.forEach((h) => {
      expect(h).toHaveProperty('area_conhecimento');
      expect(h).toHaveProperty('ano_escolar');
      expect(h).toHaveProperty('codigo_habilidade');
      expect(h).toHaveProperty('habilidade');
      expect(h).toHaveProperty('desempenho_percentual');
    });
  });

  test('habilidade codes LP3A1 and MT5A1 are present', () => {
    const codes = parsed.habilidades.map((h) => h.codigo_habilidade);
    expect(codes).toContain('LP3A1');
    expect(codes).toContain('MT5A1');
  });

  test('source trace counters match actual array lengths', () => {
    const { trace } = parsed.source;
    expect(trace.escolas).toBe(parsed.escolas.length);
    expect(trace.resultados).toBe(parsed.resultados.length);
    expect(trace.distribuicao).toBe(parsed.distribuicao.length);
    expect(trace.habilidades).toBe(parsed.habilidades.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 2 — VALIDATE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stage 2 — Validate: canonical contract compliance', () => {
  test('fixture passes validation (valid = true)', () => {
    expect(validated.valid).toBe(true);
    expect(validated.valid).toBe(baseline.pipeline.validate.valid);
  });

  test('no errors returned for the Canoas fixture', () => {
    expect(validated.errors).toHaveLength(baseline.pipeline.validate.errorsCount);
  });

  test('warnings array is present (may be empty)', () => {
    expect(Array.isArray(validated.warnings)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 3 — NORMALIZE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stage 3 — Normalize: metrics + canonical v2 model', () => {
  test('model version is "2.0"', () => {
    expect(metrics.modelVersion).toBe(EXPECTED.normalize.modelVersion);
  });

  test('totalEscolas matches fixture school count', () => {
    expect(metrics.totalEscolas).toBe(EXPECTED.normalize.totalEscolas);
    expect(metrics.totalEscolas).toBe(baseline.pipeline.normalize.totalEscolas);
  });

  test('totalAlunos = sum of alunos_finalizaram (180+130+100 = 410)', () => {
    expect(metrics.rede.totalAlunos).toBe(EXPECTED.normalize.totalAlunos);
    expect(metrics.rede.totalAlunos).toBe(baseline.pipeline.normalize.totalAlunos);
  });

  test('mediaGeral = mean of all resultados.media (≈ 43.3)', () => {
    expect(metrics.rede.mediaGeral).toBe(EXPECTED.normalize.mediaGeral);
    expect(metrics.rede.mediaGeral).toBe(baseline.pipeline.normalize.mediaGeral);
  });

  test('disciplinas list has exactly 2 entries', () => {
    expect(metrics.disciplinas).toHaveLength(EXPECTED.normalize.disciplinasCount);
  });

  test('disciplinas list contains Matemática and Língua Portuguesa', () => {
    expect(metrics.disciplinas).toContain('Matemática');
    expect(metrics.disciplinas).toContain('Língua Portuguesa');
  });

  test('anos list contains "Geral"', () => {
    expect(metrics.anos).toContain('Geral');
  });

  test('entities.escolas has 3 entries', () => {
    expect(metrics.entities.escolas).toHaveLength(EXPECTED.normalize.entitiesEscolasCount);
    expect(metrics.entities.escolas).toHaveLength(baseline.pipeline.normalize.entitiesEscolasCount);
  });

  test('entities.habilidades has 6 entries', () => {
    expect(metrics.entities.habilidades).toHaveLength(EXPECTED.normalize.entitiesHabilidadesCount);
    expect(metrics.entities.habilidades).toHaveLength(baseline.pipeline.normalize.entitiesHabilidadesCount);
  });

  test('context.municipio = "Canoas"', () => {
    expect(metrics.context.municipio).toBe('Canoas');
  });

  test('context.layout = "canoas-avaliacao-digital"', () => {
    expect(metrics.context.layout).toBe('canoas-avaliacao-digital');
  });

  test('compatibility.bookMetricsV1.rede.mediaGeral matches rede.mediaGeral', () => {
    expect(metrics.compatibility.bookMetricsV1.rede.mediaGeral).toBe(metrics.rede.mediaGeral);
  });

  test('Escola Alfa has rankingPosition 1 (highest media)', () => {
    const alfa = metrics.escolas.find((e) => e.nome_escola.toLowerCase().includes('alfa'));
    expect(alfa).toBeDefined();
    expect(alfa.rankingPosition).toBe(EXPECTED.normalize.escolaAlfaRankingPosition);
    expect(alfa.rankingPosition).toBe(baseline.pipeline.normalize.escolaAlfaRankingPosition);
  });

  test('Escola Gama has rankingPosition 3 (lowest media)', () => {
    const gama = metrics.escolas.find((e) => e.nome_escola.toLowerCase().includes('gama'));
    expect(gama).toBeDefined();
    expect(gama.rankingPosition).toBe(EXPECTED.normalize.escolaGamaRankingPosition);
    expect(gama.rankingPosition).toBe(baseline.pipeline.normalize.escolaGamaRankingPosition);
  });

  test('network distribuicao total = 747 (all 24 rows aggregated)', () => {
    expect(metrics.rede.distribuicao.total).toBe(EXPECTED.normalize.redeDistribuicaoTotal);
    expect(metrics.rede.distribuicao.total).toBe(baseline.pipeline.normalize.redeDistribuicaoTotal);
  });

  test('each escola in metrics has distribuicaoPorDisciplina', () => {
    metrics.escolas.forEach((escola) => {
      expect(escola.distribuicaoPorDisciplina).toBeDefined();
      expect(escola.distribuicaoPorDisciplina).toHaveProperty('Matemática');
      expect(escola.distribuicaoPorDisciplina).toHaveProperty('Língua Portuguesa');
    });
  });

  test('facts.participacoes is a non-empty array', () => {
    expect(Array.isArray(metrics.facts.participacoes)).toBe(true);
    expect(metrics.facts.participacoes.length).toBeGreaterThan(0);
  });

  test('facts.proficiencias is a non-empty array', () => {
    expect(Array.isArray(metrics.facts.proficiencias)).toBe(true);
    expect(metrics.facts.proficiencias.length).toBeGreaterThan(0);
  });

  test('facts.desempenhosHabilidade has 6 entries (one per habilidade)', () => {
    expect(metrics.facts.desempenhosHabilidade).toHaveLength(6);
  });

  test('facts.desempenhosHabilidade contains LP3A1 performance = 68', () => {
    const lp3a1Entity = metrics.entities.habilidades.find((h) =>
      h.codigo && h.codigo.toUpperCase() === 'LP3A1',
    );
    expect(lp3a1Entity).toBeDefined();

    const fact = metrics.facts.desempenhosHabilidade.find(
      (f) => f.habilidadeId === lp3a1Entity.id,
    );
    expect(fact).toBeDefined();
    expect(fact.desempenhoPercentual).toBe(68.0);
  });

  test('derived.comparativos.escolaVsRede has 6 entries (3 schools × 2 disciplines)', () => {
    expect(metrics.derived.comparativos.escolaVsRede).toHaveLength(6);
  });

  test('escola vs rede comparativo for Alfa / Matemática has positive delta', () => {
    const alfaId = metrics.escolas.find((e) => e.nome_escola.toLowerCase().includes('alfa'))?.id_escola;
    const comp = metrics.derived.comparativos.escolaVsRede.find(
      (c) => c.escolaId === alfaId && c.disciplina === 'Matemática',
    );
    expect(comp).toBeDefined();
    expect(comp.escola.media).toBeGreaterThan(comp.rede.media);
    expect(comp.delta.media).toBeGreaterThan(0);
  });

  test('rankings object has keys for both disciplines', () => {
    expect(metrics.rankings).toHaveProperty('Matemática');
    expect(metrics.rankings).toHaveProperty('Língua Portuguesa');
  });

  test('each ranking list has 3 schools sorted by media descending', () => {
    const matRanking = metrics.rankings['Matemática'];
    expect(matRanking).toHaveLength(3);
    for (let i = 1; i < matRanking.length; i++) {
      expect(matRanking[i - 1].media).toBeGreaterThanOrEqual(matRanking[i].media);
    }
  });

  test('paginatedRankings has single page per discipline (3 schools ≤ 25 threshold)', () => {
    expect(metrics.paginatedRankings['Matemática']).toHaveLength(1);
    expect(metrics.paginatedRankings['Língua Portuguesa']).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 4 — RENDER
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stage 4 — Render: pages + section sequence + pagination', () => {
  test('returns an array of pages', () => {
    expect(Array.isArray(pages)).toBe(true);
  });

  test(`total pages = ${EXPECTED.render.totalPages}`, () => {
    expect(pages).toHaveLength(EXPECTED.render.totalPages);
    expect(pages).toHaveLength(baseline.pipeline.render.totalPages);
  });

  test('page numbers are sequential starting from 1', () => {
    pages.forEach((page, idx) => {
      expect(page.pageNumber).toBe(idx + 1);
    });
  });

  test('section sequence matches baseline exactly', () => {
    const actual = pages.map((p) => p.section);
    expect(actual).toEqual(EXPECTED.render.sectionSequence);
    expect(actual).toEqual(baseline.pipeline.render.sectionSequence);
  });

  test('chapter pages have the expected chapterKeys in order', () => {
    const chapterPages = pages.filter((p) => p.section === 'capitulo');
    expect(chapterPages.map((p) => p.data.chapterKey)).toEqual(EXPECTED.render.chapterKeys);
  });

  test('sumario page exists and has entries pointing to real page numbers', () => {
    const sumario = pages.find((p) => p.section === 'sumario');
    expect(sumario).toBeDefined();
    expect(sumario.data.entries.length).toBeGreaterThan(0);
    sumario.data.entries.forEach((entry) => {
      expect(typeof entry.title).toBe('string');
      expect(typeof entry.page).toBe('number');
      expect(entry.page).toBeGreaterThan(0);
    });
  });

  test('sumario includes editorial chapter titles', () => {
    const sumario = pages.find((p) => p.section === 'sumario');
    const titles = sumario.data.entries.map((e) => e.title);
    expect(titles).toContain('Antes da Avaliação');
    expect(titles).toContain('Durante a Aplicação');
    expect(titles).toContain('Resultados');
  });

  test('capa page has municipio "Canoas" and ano "2025"', () => {
    const capa = pages.find((p) => p.section === 'capa');
    expect(capa.data.municipio).toBe('Canoas');
    expect(String(capa.data.ano)).toBe('2025');
  });

  test('visao_geral page reports 3 escolas', () => {
    const pg = pages.find((p) => p.section === 'visao_geral');
    expect(pg.data.totalEscolas).toBe(3);
  });

  test('exactly 2 resultados_disciplina pages', () => {
    const dpages = pages.filter((p) => p.section === 'resultados_disciplina');
    expect(dpages).toHaveLength(2);
    const disciplinas = dpages.map((p) => p.data.disciplina);
    expect(disciplinas).toContain('Matemática');
    expect(disciplinas).toContain('Língua Portuguesa');
  });

  test('exactly 1 resultados_ano page (ano "Geral")', () => {
    const anoPages = pages.filter((p) => p.section === 'resultados_ano');
    expect(anoPages).toHaveLength(1);
    expect(anoPages[0].data.ano).toBe('Geral');
  });

  test(`exactly ${EXPECTED.render.rankingPagesCount} ranking pages (3 schools ≤ 25 threshold)`, () => {
    const rankingPages = pages.filter((p) => p.section === 'ranking');
    expect(rankingPages).toHaveLength(EXPECTED.render.rankingPagesCount);
    expect(rankingPages).toHaveLength(baseline.pipeline.render.rankingPagesCount);
  });

  test(`exactly ${EXPECTED.render.habilidadesPagesCount} habilidades_disciplina pages`, () => {
    const habPages = pages.filter((p) => p.section === 'habilidades_disciplina');
    expect(habPages).toHaveLength(EXPECTED.render.habilidadesPagesCount);
    expect(habPages).toHaveLength(baseline.pipeline.render.habilidadesPagesCount);
  });

  test('habilidades pages contain all 6 habilidades rows distributed across disciplines', () => {
    const habPages = pages.filter((p) => p.section === 'habilidades_disciplina');
    const totalRows = habPages.reduce((sum, pg) => sum + pg.data.rows.length, 0);
    expect(totalRows).toBe(6);
  });

  test('each habilidades page has pageIndex 0 (< 20-row threshold — no multi-page split)', () => {
    pages.filter((p) => p.section === 'habilidades_disciplina').forEach((pg) => {
      expect(pg.data.pageIndex).toBe(0);
      expect(pg.data.totalPages).toBe(1);
    });
  });

  test(`exactly ${EXPECTED.render.escolaPagesCount} escola pages`, () => {
    const escolaPages = pages.filter((p) => p.section === 'escola');
    expect(escolaPages).toHaveLength(EXPECTED.render.escolaPagesCount);
    expect(escolaPages).toHaveLength(baseline.pipeline.render.escolaPagesCount);
  });

  test(`exactly ${EXPECTED.render.escolaDiscPagesCount} escola_disciplinas pages`, () => {
    const escDiscPages = pages.filter((p) => p.section === 'escola_disciplinas');
    expect(escDiscPages).toHaveLength(EXPECTED.render.escolaDiscPagesCount);
    expect(escDiscPages).toHaveLength(baseline.pipeline.render.escolaDiscPagesCount);
  });

  test('escola pages cover all three schools', () => {
    const escolaNames = pages
      .filter((p) => p.section === 'escola')
      .map((p) => p.data.nome_escola);
    const fixtureNames = FIXTURE.schools.map((s) => s.nome);
    expect(escolaNames).toEqual(expect.arrayContaining(fixtureNames));
  });

  test('escola page carries rankingPosition and mediaRede', () => {
    const pg = pages.find((p) => p.section === 'escola');
    expect(pg.data.rankingPosition).toBeGreaterThan(0);
    expect(pg.data.mediaRede).toBeCloseTo(EXPECTED.normalize.mediaGeral, 0);
  });

  test('escola page carries operacional snapshot with previstos/iniciaram/finalizaram', () => {
    const pg = pages.find((p) => p.section === 'escola');
    expect(pg.data.operacional).toBeDefined();
    expect(pg.data.operacional.previstos).toBeGreaterThan(0);
    expect(pg.data.operacional.iniciaram).toBeGreaterThan(0);
    expect(pg.data.operacional.finalizaram).toBeGreaterThan(0);
    expect(pg.data.operacional.participacaoTotal).toBeGreaterThan(0);
  });

  test('escola_disciplinas page has participacaoPorDisciplina with 2 rows', () => {
    const pg = pages.find((p) => p.section === 'escola_disciplinas');
    expect(pg.data.participacaoPorDisciplina).toHaveLength(2);
    const disciplinas = pg.data.participacaoPorDisciplina.map((r) => r.disciplina);
    expect(disciplinas).toContain('Matemática');
    expect(disciplinas).toContain('Língua Portuguesa');
  });

  test('proximos_passos page has recommendations array', () => {
    const pg = pages.find((p) => p.section === 'proximos_passos');
    expect(pg).toBeDefined();
    expect(Array.isArray(pg.data.recommendations)).toBe(true);
    expect(pg.data.recommendations.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 5 — CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stage 5 — Charts: descriptors per page', () => {
  test('chartsPerPage array has same length as pages', () => {
    expect(chartsPerPage).toHaveLength(pages.length);
  });

  test(`visao_geral page has ${EXPECTED.charts.visaoGeralChartCount} charts`, () => {
    const idx = pages.findIndex((p) => p.section === 'visao_geral');
    expect(chartsPerPage[idx]).toHaveLength(EXPECTED.charts.visaoGeralChartCount);
    expect(chartsPerPage[idx]).toHaveLength(baseline.pipeline.charts.visaoGeralChartCount);
  });

  test('visao_geral charts include a distribution chart and indicator cards', () => {
    const idx = pages.findIndex((p) => p.section === 'visao_geral');
    const types = chartsPerPage[idx].map((c) => c.type);
    expect(types).toContain('distribution');
    expect(types).toContain('indicator');
  });

  test(`each resultados_disciplina page has ${EXPECTED.charts.resultadosDisciplinaChartCount} charts`, () => {
    pages.forEach((page, idx) => {
      if (page.section !== 'resultados_disciplina') return;
      expect(chartsPerPage[idx]).toHaveLength(EXPECTED.charts.resultadosDisciplinaChartCount);
    });
  });

  test(`each ranking page has ${EXPECTED.charts.rankingChartCount} ranking chart`, () => {
    pages.forEach((page, idx) => {
      if (page.section !== 'ranking') return;
      expect(chartsPerPage[idx]).toHaveLength(EXPECTED.charts.rankingChartCount);
      expect(chartsPerPage[idx][0].type).toBe('ranking');
    });
  });

  test(`each habilidades_disciplina page has ${EXPECTED.charts.habilidadesChartCount} charts`, () => {
    pages.forEach((page, idx) => {
      if (page.section !== 'habilidades_disciplina') return;
      expect(chartsPerPage[idx]).toHaveLength(EXPECTED.charts.habilidadesChartCount);
      expect(chartsPerPage[idx][0].type).toBe('indicator');
    });
  });

  test(`each escola page has ${EXPECTED.charts.escolaChartCount} charts (distribution + 4 operacional cards)`, () => {
    pages.forEach((page, idx) => {
      if (page.section !== 'escola') return;
      expect(chartsPerPage[idx]).toHaveLength(EXPECTED.charts.escolaChartCount);
      expect(chartsPerPage[idx]).toHaveLength(baseline.pipeline.charts.escolaChartCount);
    });
  });

  test(`each escola_disciplinas page has ${EXPECTED.charts.escolaDiscChartCount} comparativo_chart`, () => {
    pages.forEach((page, idx) => {
      if (page.section !== 'escola_disciplinas') return;
      expect(chartsPerPage[idx]).toHaveLength(EXPECTED.charts.escolaDiscChartCount);
      expect(chartsPerPage[idx].some((chart) => chart.type === 'comparativo_chart')).toBe(true);
      expect(chartsPerPage[idx].some((chart) => chart.titulo === 'Posição Geral')).toBe(true);
    });
  });

  test('ranking chart bars include all 3 schools', () => {
    const rankingIdx = pages.findIndex((p) => p.section === 'ranking');
    const rankingChart = chartsPerPage[rankingIdx][0];
    expect(rankingChart.bars).toHaveLength(3);
  });

  test('chart pages with no applicable section produce empty arrays', () => {
    const capaIdx = pages.findIndex((p) => p.section === 'capa');
    expect(chartsPerPage[capaIdx]).toHaveLength(0);
    const sumarioIdx = pages.findIndex((p) => p.section === 'sumario');
    expect(chartsPerPage[sumarioIdx]).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 6 — EXPORT JSON
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stage 6 — Export JSON: deterministic filename + file shape', () => {
  let jsonOutputPath;
  let jsonContent;

  beforeAll(async () => {
    jsonOutputPath = await exportJson(
      pages,
      chartsPerPage,
      parsed.metadata,
      tempDir,
      { version: 'v1' },
    );
    jsonContent = JSON.parse(fs.readFileSync(jsonOutputPath, 'utf-8'));
  });

  test('output file exists and is non-empty', () => {
    expect(fs.existsSync(jsonOutputPath)).toBe(true);
    expect(fs.statSync(jsonOutputPath).size).toBeGreaterThan(0);
  });

  test(`filename matches expected pattern: ${EXPECTED.export.jsonFilename}`, () => {
    expect(path.basename(jsonOutputPath)).toBe(EXPECTED.export.jsonFilename);
    expect(path.basename(jsonOutputPath)).toBe(baseline.pipeline.exportJson.filename);
  });

  test('JSON has metadata field', () => {
    expect(jsonContent).toHaveProperty('metadata');
    expect(jsonContent.metadata.municipio).toBe('Canoas');
  });

  test('JSON has pages array with correct length', () => {
    expect(Array.isArray(jsonContent.pages)).toBe(true);
    expect(jsonContent.pages).toHaveLength(EXPECTED.render.totalPages);
    expect(jsonContent.pages).toHaveLength(baseline.pipeline.exportJson.pageCount);
  });

  test('each page in JSON has a charts array attached', () => {
    jsonContent.pages.forEach((page) => {
      expect(Array.isArray(page.charts)).toBe(true);
    });
  });

  test('JSON has generatedAt and version fields', () => {
    expect(jsonContent).toHaveProperty('generatedAt');
    expect(jsonContent.version).toBe('v1');
  });

  test('round-trip: sections in JSON match rendered section sequence', () => {
    const jsonSections = jsonContent.pages.map((p) => p.section);
    expect(jsonSections).toEqual(EXPECTED.render.sectionSequence);
  });

  test('round-trip: visao_geral page in JSON has correct totalEscolas', () => {
    const vg = jsonContent.pages.find((p) => p.section === 'visao_geral');
    expect(vg.data.totalEscolas).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 7 — EXPORT PDF (browser mocked — CI-safe)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stage 7 — Export PDF: mocked browser (CI-safe)', () => {
  beforeEach(() => {
    // Simulate a headless browser that writes a minimal valid PDF header
    execFile.mockImplementation((browserPath, args, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      const pdfArg = args.find((a) => String(a).startsWith('--print-to-pdf='));
      if (pdfArg) {
        const pdfPath = String(pdfArg).slice('--print-to-pdf='.length);
        fs.writeFileSync(pdfPath, '%PDF-1.4\n% mocked by regression suite\n', 'utf-8');
      }
      done(null, '', '');
    });
  });

  afterEach(() => {
    execFile.mockReset();
  });

  test('exportPdf() writes a PDF file to outputDir', async () => {
    const pdfSubDir = path.join(tempDir, 'pdf-test');
    fs.mkdirSync(pdfSubDir, { recursive: true });

    // Provide a fake browser executable so resolvePdfBrowserPath() accepts it
    const fakeBrowser = path.join(pdfSubDir, 'msedge.exe');
    fs.writeFileSync(fakeBrowser, '');

    const outputFile = await exportPdf(
      pages,
      chartsPerPage,
      parsed.metadata,
      pdfSubDir,
      { version: 'v1', browserPath: fakeBrowser },
    );

    expect(fs.existsSync(outputFile)).toBe(true);
    expect(outputFile).toMatch(/\.pdf$/);
    expect(fs.readFileSync(outputFile, 'utf-8')).toContain('%PDF-1.4');
  });

  test(`PDF filename matches expected pattern: ${EXPECTED.export.pdfFilename}`, async () => {
    const pdfSubDir = path.join(tempDir, 'pdf-filename-test');
    fs.mkdirSync(pdfSubDir, { recursive: true });

    const fakeBrowser = path.join(pdfSubDir, 'msedge.exe');
    fs.writeFileSync(fakeBrowser, '');

    const outputFile = await exportPdf(
      pages,
      chartsPerPage,
      parsed.metadata,
      pdfSubDir,
      { version: 'v1', browserPath: fakeBrowser },
    );

    expect(path.basename(outputFile)).toBe(EXPECTED.export.pdfFilename);
    expect(path.basename(outputFile)).toBe(baseline.pipeline.exportPdf.filename);
  });

  test('intermediate HTML file is cleaned up by default', async () => {
    const pdfSubDir = path.join(tempDir, 'pdf-html-cleanup-test');
    fs.mkdirSync(pdfSubDir, { recursive: true });

    const fakeBrowser = path.join(pdfSubDir, 'msedge.exe');
    fs.writeFileSync(fakeBrowser, '');

    await exportPdf(pages, chartsPerPage, parsed.metadata, pdfSubDir, {
      version: 'v1',
      browserPath: fakeBrowser,
    });

    const htmlFiles = fs.readdirSync(pdfSubDir).filter((f) => f.endsWith('.print.html'));
    expect(htmlFiles).toHaveLength(0);
  });
});

describe('Stage 7.5 — HTML/PDF fidelity: institutional composition from the Canoas pipeline', () => {
  let fidelityOutputDir;
  let htmlOutputPath;
  let pdfOutputPath;
  let html;
  let pageBlocks;

  beforeAll(async () => {
    fidelityOutputDir = path.join(tempDir, 'pdf-fidelity');
    fs.mkdirSync(fidelityOutputDir, { recursive: true });

    const fakeBrowser = path.join(fidelityOutputDir, 'msedge.exe');
    fs.writeFileSync(fakeBrowser, '');

    execFile.mockImplementation((browserPath, args, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      const pdfArg = args.find((arg) => String(arg).startsWith('--print-to-pdf='));
      if (pdfArg) {
        const renderedPdfPath = String(pdfArg).slice('--print-to-pdf='.length);
        fs.writeFileSync(renderedPdfPath, '%PDF-1.4\n% fidelity regression mock\n', 'utf-8');
      }
      done(null, '', '');
    });

    pdfOutputPath = await exportPdf(
      pages,
      chartsPerPage,
      parsed.metadata,
      fidelityOutputDir,
      { version: 'v1', browserPath: fakeBrowser, keepHtml: true },
    );
    htmlOutputPath = path.join(
      fidelityOutputDir,
      `${path.parse(EXPECTED.export.pdfFilename).name}.print.html`,
    );
    html = fs.readFileSync(htmlOutputPath, 'utf-8');
    pageBlocks = getRenderedPageBlocks(html);
  });

  afterAll(() => {
    execFile.mockReset();
  });

  test('keeps an inspectable print HTML that mirrors rendered page ordering', () => {
    expect(fs.existsSync(pdfOutputPath)).toBe(true);
    expect(fs.existsSync(htmlOutputPath)).toBe(true);
    expect(fs.readFileSync(pdfOutputPath, 'utf-8')).toContain('%PDF-1.4');
    expect(pageBlocks).toHaveLength(baseline.pipeline.htmlFidelity.pageCount);
    expect(pageBlocks.map((pageBlock) => pageBlock.section)).toEqual(
      baseline.pipeline.render.sectionSequence,
    );
    expect(pageBlocks.map((pageBlock) => pageBlock.section)).toEqual(
      pages.map((page) => page.section),
    );
  });

  test('renders the institutional cover/opener and chapter opener composition', () => {
    const coverPage = findRenderedPage(pageBlocks, 'capa');
    const chapterPages = pageBlocks.filter((pageBlock) => pageBlock.section === 'capitulo');

    expect(coverPage).toBeDefined();
    expect(coverPage.className).toContain('cover-page');
    expect(coverPage.className).toContain('layout-template-cover-page');
    expect(coverPage.className).toContain('layout-variant-institutional-cover');
    expect(coverPage.html).toContain('class="cover-hero"');
    expect(coverPage.html).toContain('class="cover-band"');
    expect(coverPage.text).toContain(baseline.pipeline.htmlFidelity.cover.kicker);
    expect(coverPage.text).toContain(baseline.pipeline.htmlFidelity.cover.bandTitle);
    expect(coverPage.text).toContain(baseline.pipeline.htmlFidelity.cover.reportTitle);
    expect(coverPage.text).toContain(baseline.pipeline.htmlFidelity.cover.city);
    expect(coverPage.text).toContain(baseline.pipeline.htmlFidelity.cover.edition);

    expect(chapterPages).toHaveLength(baseline.pipeline.htmlFidelity.chapterPageCount);
    chapterPages.forEach((chapterPage) => {
      expect(chapterPage.className).toContain('chapter-page');
      expect(chapterPage.className).toContain('layout-template-chapter-opener');
      expect(chapterPage.className).toContain('layout-priority-primary');
      expect(chapterPage.html).toMatch(/class="chapter-hero(?:\s|")/);
      expect(chapterPage.html).toContain('class="chapter-divider"');
    });

    expect(chapterPages.map((chapterPage) => chapterPage.text)).toEqual(
      expect.arrayContaining(
        baseline.pipeline.htmlFidelity.chapters.markers.map((marker, index) =>
          expect.stringContaining(
            `${marker} ${baseline.pipeline.htmlFidelity.chapters.titles[index]}`,
          ),
        ),
      ),
    );
  });

  test('renders analytical overview and school layouts with redesigned visual primitives intact', () => {
    const overviewPage = findRenderedPage(pageBlocks, 'visao_geral');
    const disciplinaPage = findRenderedPage(
      pageBlocks,
      'resultados_disciplina',
      (pageBlock) => pageBlock.text.includes('Matemática'),
    );
    const matematicaRankingPage = findRenderedPage(
      pageBlocks,
      'ranking',
      (pageBlock) => pageBlock.text.includes('Matemática'),
    );
    const alfaSchoolPage = findRenderedPage(
      pageBlocks,
      'escola',
      (pageBlock) => pageBlock.text.includes('EMEF Escola Alfa'),
    );
    const alfaComparativePage = findRenderedPage(
      pageBlocks,
      'escola_disciplinas',
      (pageBlock) => pageBlock.text.includes('EMEF Escola Alfa'),
    );

    expect(countOccurrences(html, /class="analytic-split"/g)).toBe(
      baseline.pipeline.htmlFidelity.analyticSplitCount,
    );
    Object.entries(baseline.pipeline.htmlFidelity.analyticSplitByLayout).forEach(
      ([layoutName, expectedCount]) => {
        expect(
          countOccurrences(
            html,
            new RegExp(`<div class="analytic-split" data-layout="${escapeRegExp(layoutName)}">`, 'g'),
          ),
        ).toBe(expectedCount);
      },
    );

    expect(overviewPage).toBeDefined();
    expect(overviewPage.className).toContain('layout-template-network-overview');
    expect(overviewPage.className).toContain('layout-style-analytic-overview');
    expect(overviewPage.className).toContain('layout-source-manifest');
    expect(overviewPage.className).toContain('layout-priority-primary');
    expect(overviewPage.html).toContain('class="priority-template priority-template-visao_geral"');
    expect(overviewPage.html).toContain('class="hero-panel hero-panel-overview"');
    expect(overviewPage.html).toContain('class="priority-context-band"');
    expect(overviewPage.html).toContain('data-layout="network-overview-shell"');
    expect(overviewPage.html).toContain('class="indicator-grid overview-indicator-grid"');
    expect(overviewPage.html).toContain('class="indicator-card indicator-card-participacao-media"');
    expect(overviewPage.html).toContain('class="priority-context-card priority-context-card-referencia"');
    expect(overviewPage.html).toContain('class="panel panel-overview-summary"');
    expect(overviewPage.html).toContain('class="summary-callout summary-callout-overview"');
    expect(overviewPage.html).toContain('class="overview-shell-main"');
    expect(overviewPage.html).toContain('class="overview-shell-aside"');
    expect(overviewPage.text).toContain('Referência visual');
    expect(overviewPage.text).toContain('Book atual');
    baseline.pipeline.htmlFidelity.overview.indicatorLabels.forEach((label) => {
      expect(overviewPage.text).toContain(label);
    });
    baseline.pipeline.htmlFidelity.overview.panelTitles.forEach((title) => {
      expect(overviewPage.text).toContain(title);
    });
    expect(overviewPage.html).toContain('chart-panel chart-panel-distribution');
    expect(overviewPage.html).toContain('class="summary-table"');

    expect(disciplinaPage).toBeDefined();
    expect(disciplinaPage.className).toContain('layout-template-discipline-results');
    expect(disciplinaPage.className).toContain('layout-priority-primary');
    expect(disciplinaPage.html).toContain('class="priority-template priority-template-resultados_disciplina"');
    expect(disciplinaPage.html).toContain('class="hero-panel hero-panel-discipline"');
    expect(disciplinaPage.html).toContain('class="priority-context-band"');
    expect(disciplinaPage.html).toContain('data-layout="discipline-results-shell"');
    expect(disciplinaPage.text).toContain('Resultados por área');
    expect(disciplinaPage.text).toContain('Referência visual');
    expect(disciplinaPage.text).toContain('Book atual');

    expect(matematicaRankingPage).toBeDefined();
    expect(matematicaRankingPage.className).toContain('layout-template-ranking-table');
    expect(matematicaRankingPage.className).toContain('layout-style-dense-table');
    expect(matematicaRankingPage.className).toContain('layout-source-manifest');
    expect(matematicaRankingPage.className).toContain('layout-frame-ranking-frame');
    expect(matematicaRankingPage.className).toContain('layout-chrome-framed');
    expect(matematicaRankingPage.html).toContain('data-chrome-mode="framed"');
    expect(matematicaRankingPage.html).toContain('data-style-ref="dense-table"');
    expect(matematicaRankingPage.html).toContain('data-layout-source="manifest"');
    expect(matematicaRankingPage.html).toContain('class="chart-grid dense-table-chart-grid"');
    expect(matematicaRankingPage.html).toContain('class="chart-panel chart-panel-ranking chart-panel-dense-table"');
    expect(matematicaRankingPage.html).toContain('class="panel dense-table-panel dense-table-panel-ranking"');
    expect(matematicaRankingPage.html).toContain('class="data-table dense-table-table"');
    expect(matematicaRankingPage.html).not.toContain('class="page-number"');
    expect(matematicaRankingPage.html).not.toContain('class="page-footer"');
    expect(matematicaRankingPage.html).not.toContain('class="page-header"');
    expect(matematicaRankingPage.text).toContain('Leitura comparativa do ranking escolar em Matemática.');
    baseline.pipeline.htmlFidelity.ranking.tableHeaders.forEach((header) => {
      expect(matematicaRankingPage.text).toContain(header);
    });
    baseline.pipeline.htmlFidelity.ranking.sampleRows.forEach((rowLabel) => {
      expect(matematicaRankingPage.text).toContain(rowLabel);
    });

    expect(alfaSchoolPage).toBeDefined();
    expect(alfaSchoolPage.className).toContain('layout-chrome-framed');
    expect(alfaSchoolPage.html).toContain('data-chrome-mode="framed"');
    expect(alfaSchoolPage.html).not.toContain('class="page-number"');
    expect(alfaSchoolPage.html).not.toContain('class="page-footer"');
    expect(alfaSchoolPage.html).not.toContain('class="page-header"');
    // Sprint 3: no invented visual details
    expect(alfaSchoolPage.text).not.toContain('✦');
    expect(alfaSchoolPage.html).not.toContain('owl-mascot');
    expect(alfaSchoolPage.html).toContain('class="school-owl-image"');
    expect(alfaSchoolPage.html).toContain('class="school-brand-eyebrow"');
    baseline.pipeline.htmlFidelity.school.operationalLabels.forEach((label) => {
      expect(alfaSchoolPage.text).toContain(label);
    });
    expect(alfaSchoolPage.text).toContain('Distribuição de Proficiência — EMEF Escola Alfa');
    expect(alfaSchoolPage.text).toContain('A média geral da escola está acima da média da rede');

    expect(alfaComparativePage).toBeDefined();
    expect(alfaComparativePage.className).toContain('layout-chrome-framed');
    expect(alfaComparativePage.html).toContain('data-chrome-mode="framed"');
    expect(alfaComparativePage.html).not.toContain('class="page-number"');
    expect(alfaComparativePage.html).not.toContain('class="page-footer"');
    expect(alfaComparativePage.html).not.toContain('class="page-header"');
    expect(alfaComparativePage.html).toContain('class="reference-school-area"');
    expect(alfaComparativePage.html).toContain('class="data-table"');
    expect(alfaComparativePage.text).toContain('Matemática');
    expect(alfaComparativePage.text).toContain('Língua Portuguesa');
    expect(alfaComparativePage.text).toContain('Δ Média');
    baseline.pipeline.htmlFidelity.school.comparisonTableHeaders.forEach((header) => {
      expect(alfaComparativePage.text).toContain(header);
    });
  });

  test('renders habilidades pages with context strip, skills table and stable discipline ordering', () => {
    const habilidadesPages = pageBlocks.filter(
      (pageBlock) => pageBlock.section === 'habilidades_disciplina',
    );

    expect(habilidadesPages).toHaveLength(
      baseline.pipeline.htmlFidelity.habilidades.disciplineOrder.length,
    );
    expect(countOccurrences(html, /class="context-strip dense-table-context-strip"/g)).toBe(
      baseline.pipeline.htmlFidelity.contextStripCount,
    );
    expect(countOccurrences(html, /class="skills-table dense-table-table"/g)).toBe(
      baseline.pipeline.htmlFidelity.skillsTableCount,
    );

    habilidadesPages.forEach((pageBlock) => {
      expect(pageBlock.className).toContain('layout-template-skills-table');
      expect(pageBlock.className).toContain('layout-style-dense-table');
      expect(pageBlock.className).toContain('layout-source-manifest');
      expect(pageBlock.className).toContain(`layout-frame-${baseline.pipeline.htmlFidelity.habilidades.frameId}`);
      expect(pageBlock.className).toContain('layout-chrome-framed');
      expect(pageBlock.html).toContain('data-style-ref="dense-table"');
      expect(pageBlock.html).toContain('data-layout-source="manifest"');
      expect(pageBlock.html).toContain(`data-frame-id="${baseline.pipeline.htmlFidelity.habilidades.frameId}"`);
      expect(pageBlock.html).toContain(`data-chrome-mode="${baseline.pipeline.htmlFidelity.habilidades.chromeMode}"`);
      expect(pageBlock.html).toContain('class="framed-page-meta sr-only"');
      expect(pageBlock.html).not.toContain('class="page-number"');
      expect(pageBlock.html).not.toContain('class="page-footer"');
      expect(pageBlock.html).not.toContain('class="page-header"');
      expect(pageBlock.html).toContain('class="context-strip dense-table-context-strip"');
      expect(pageBlock.html).toContain('class="panel dense-table-panel dense-table-panel-skills"');
      expect(pageBlock.html).toContain('class="skills-table dense-table-table"');
      baseline.pipeline.htmlFidelity.habilidades.contextLabels.forEach((label) => {
        expect(pageBlock.text).toContain(label);
      });
    });

    expect(habilidadesPages[0].text).toContain(
      baseline.pipeline.htmlFidelity.habilidades.disciplineOrder[0],
    );
    expect(habilidadesPages[1].text).toContain(
      baseline.pipeline.htmlFidelity.habilidades.disciplineOrder[1],
    );
    baseline.pipeline.htmlFidelity.habilidades.firstPageCodes.forEach((code) => {
      expect(habilidadesPages[0].text).toContain(code);
    });
    baseline.pipeline.htmlFidelity.habilidades.secondPageCodes.forEach((code) => {
      expect(habilidadesPages[1].text).toContain(code);
    });
    expect(habilidadesPages[0].text).toContain('3 habilidades');
    expect(habilidadesPages[0].text).toContain('1 / 1');
    expect(countOccurrences(habilidadesPages[0].html, /class="skill-score-pill"/g)).toBe(3);
    expect(countOccurrences(habilidadesPages[1].html, /class="skill-score-pill"/g)).toBe(3);
  });

  test('keeps sumário references aligned with rendered page numbering in the exported HTML', () => {
    const sumarioPage = findRenderedPage(pageBlocks, 'sumario');

    expect(sumarioPage).toBeDefined();
    baseline.pipeline.htmlFidelity.sumarioChecks.forEach((entry) => {
      expect(sumarioPage.html).toMatch(
        new RegExp(
          `${escapeRegExp(entry.title)}[\\s\\S]*?<td>${entry.page}<\\/td>`,
        ),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 8 — Full pipeline via generateBook() public API
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stage 8 — Full pipeline: generateBook() public API', () => {
  describe('format = "json" (no browser required)', () => {
    test('generateBook() succeeds and returns success=true', async () => {
      const outDir = path.join(tempDir, 'full-pipeline-json');
      fs.mkdirSync(outDir, { recursive: true });

      const result = await generateBook({
        inputFile: workbookPath,
        outputDir: outDir,
        format: 'json',
        version: 'v1',
      });

      expect(result.success).toBe(true);
    });

    test('generateBook() result has expected shape', async () => {
      const outDir = path.join(tempDir, 'full-pipeline-json-shape');
      fs.mkdirSync(outDir, { recursive: true });

      const result = await generateBook({
        inputFile: workbookPath,
        outputDir: outDir,
        format: 'json',
        version: 'v1',
      });

      expect(result).toMatchObject({
        success: true,
        pageCount: EXPECTED.render.totalPages,
        filename: EXPECTED.export.jsonFilename,
        warnings: expect.any(Array),
        log: expect.any(Array),
        durationMs: expect.any(Number),
      });
    });

    test('log contains all expected pipeline steps', async () => {
      const outDir = path.join(tempDir, 'full-pipeline-json-log');
      fs.mkdirSync(outDir, { recursive: true });

      const result = await generateBook({
        inputFile: workbookPath,
        outputDir: outDir,
        format: 'json',
        version: 'v1',
      });

      const stepNames = result.log.map((entry) => entry.step);
      ['parse', 'validate', 'normalize', 'render', 'charts', 'export'].forEach((step) => {
        expect(stepNames).toContain(step);
      });
    });

    test('output JSON file exists and has the correct page count', async () => {
      const outDir = path.join(tempDir, 'full-pipeline-json-file');
      fs.mkdirSync(outDir, { recursive: true });

      const result = await generateBook({
        inputFile: workbookPath,
        outputDir: outDir,
        format: 'json',
        version: 'v1',
      });

      expect(fs.existsSync(result.outputFile)).toBe(true);
      const content = JSON.parse(fs.readFileSync(result.outputFile, 'utf-8'));
      expect(content.pages).toHaveLength(EXPECTED.render.totalPages);
    });
  });

  describe('format = "pdf" (mocked browser)', () => {
    beforeEach(() => {
      execFile.mockImplementation((browserPath, args, options, callback) => {
        const done = typeof options === 'function' ? options : callback;
        const pdfArg = args.find((a) => String(a).startsWith('--print-to-pdf='));
        if (pdfArg) {
          const pdfPath = String(pdfArg).slice('--print-to-pdf='.length);
          fs.writeFileSync(pdfPath, '%PDF-1.4\n% full-pipeline mock\n', 'utf-8');
        }
        done(null, '', '');
      });
    });

    afterEach(() => {
      execFile.mockReset();
    });

    test('generateBook() with format="pdf" produces a .pdf output', async () => {
      const outDir = path.join(tempDir, 'full-pipeline-pdf');
      fs.mkdirSync(outDir, { recursive: true });

      const fakeBrowser = path.join(outDir, 'msedge.exe');
      fs.writeFileSync(fakeBrowser, '');

      const result = await generateBook({
        inputFile: workbookPath,
        outputDir: outDir,
        format: 'pdf',
        version: 'v1',
        pdfBrowserPath: fakeBrowser,
      });

      expect(result.success).toBe(true);
      expect(result.outputFile).toMatch(/\.pdf$/);
      expect(result.filename).toBe(EXPECTED.export.pdfFilename);
      expect(fs.existsSync(result.outputFile)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BASELINE UPDATE — writes canoas-baseline.json when UPDATE_BASELINE=1
// ═══════════════════════════════════════════════════════════════════════════════

describe('Baseline helper (only active when UPDATE_BASELINE=1)', () => {
  test('writes updated baseline if env var UPDATE_BASELINE=1 is set', () => {
    if (process.env.UPDATE_BASELINE !== '1') {
      // Normal run — just verify baseline file is readable and valid JSON
      expect(() => JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'))).not.toThrow();
      return;
    }

    // ── Compute actual structural values from the pipeline run ──
    const actualParse = {
      layout: parsed.source.layout,
      municipio: parsed.metadata.municipio,
      ano: parsed.metadata.ano,
      ciclo: parsed.metadata.ciclo,
      escolasCount: parsed.escolas.length,
      resultadosCount: parsed.resultados.length,
      distribuicaoCount: parsed.distribuicao.length,
      habilidadesCount: parsed.habilidades.length,
      deterministic: baseline.pipeline.parse.deterministic, // preserved from prior baseline
    };

    const actualValidate = {
      valid: validated.valid,
      errorsCount: validated.errors.length,
    };

    const actualNormalize = {
      modelVersion: metrics.modelVersion,
      totalEscolas: metrics.totalEscolas,
      totalAlunos: metrics.rede.totalAlunos,
      mediaGeral: metrics.rede.mediaGeral,
      disciplinasCount: metrics.disciplinas.length,
      entitiesEscolasCount: metrics.entities.escolas.length,
      entitiesHabilidadesCount: metrics.entities.habilidades.length,
      escolaAlfaRankingPosition: metrics.escolas.find((e) => e.nome_escola.toLowerCase().includes('alfa'))?.rankingPosition,
      escolaGamaRankingPosition: metrics.escolas.find((e) => e.nome_escola.toLowerCase().includes('gama'))?.rankingPosition,
      redeDistribuicaoTotal: metrics.rede.distribuicao.total,
    };

    const actualRender = {
      totalPages: pages.length,
      chapterKeys: pages.filter((p) => p.section === 'capitulo').map((p) => p.data.chapterKey),
      escolaPagesCount: pages.filter((p) => p.section === 'escola').length,
      escolaDiscPagesCount: pages.filter((p) => p.section === 'escola_disciplinas').length,
      habilidadesPagesCount: pages.filter((p) => p.section === 'habilidades_disciplina').length,
      rankingPagesCount: pages.filter((p) => p.section === 'ranking').length,
      sectionSequence: pages.map((p) => p.section),
      sectionAnnotations: baseline.pipeline.render.sectionAnnotations, // preserved
    };

    const escolaChartCount = (() => {
      const idx = pages.findIndex((p) => p.section === 'escola');
      return idx >= 0 ? chartsPerPage[idx].length : 0;
    })();

    const actualCharts = {
      visaoGeralChartCount: chartsPerPage[pages.findIndex((p) => p.section === 'visao_geral')]?.length ?? 0,
      resultadosDisciplinaChartCount: chartsPerPage[pages.findIndex((p) => p.section === 'resultados_disciplina')]?.length ?? 0,
      rankingChartCount: chartsPerPage[pages.findIndex((p) => p.section === 'ranking')]?.length ?? 0,
      habilidadesChartCount: chartsPerPage[pages.findIndex((p) => p.section === 'habilidades_disciplina')]?.length ?? 0,
      escolaChartCount,
      escolaDiscChartCount: chartsPerPage[pages.findIndex((p) => p.section === 'escola_disciplinas')]?.length ?? 0,
      notes: baseline.pipeline.charts.notes,
    };

    const html = buildHtmlDocument(pages, chartsPerPage, parsed.metadata, { version: 'v1' });
    const renderedPageBlocks = getRenderedPageBlocks(html);
    const htmlFidelity = {
      pageCount: renderedPageBlocks.length,
      chapterPageCount: renderedPageBlocks.filter((pageBlock) => pageBlock.section === 'capitulo').length,
      analyticSplitCount: countOccurrences(html, /class="analytic-split"/g),
      contextStripCount: countOccurrences(html, /class="context-strip"/g),
      skillsTableCount: countOccurrences(html, /class="skills-table"/g),
      comparativoChartRowCount: countOccurrences(html, /class="comparativo-chart-row"/g),
      cover: baseline.pipeline.htmlFidelity.cover,
      chapters: baseline.pipeline.htmlFidelity.chapters,
      overview: baseline.pipeline.htmlFidelity.overview,
      school: baseline.pipeline.htmlFidelity.school,
      habilidades: baseline.pipeline.htmlFidelity.habilidades,
      sumarioChecks: baseline.pipeline.htmlFidelity.sumarioChecks,
    };

    const updatedBaseline = {
      ...baseline,
      pipeline: {
        parse: actualParse,
        validate: actualValidate,
        normalize: actualNormalize,
        render: actualRender,
        charts: actualCharts,
        exportJson: {
          filename: EXPECTED.export.jsonFilename,
          hasMetadata: true,
          hasPages: true,
          pageCount: pages.length,
          eachPageHasCharts: true,
        },
        exportPdf: {
          filename: EXPECTED.export.pdfFilename,
          note: baseline.pipeline.exportPdf.note,
        },
        htmlFidelity,
      },
    };

    fs.writeFileSync(BASELINE_PATH, JSON.stringify(updatedBaseline, null, 2) + '\n', 'utf-8');
    console.log(`\n✅  Baseline updated: ${BASELINE_PATH}`);

    // Verify it round-trips cleanly
    expect(() => JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'))).not.toThrow();
  });
});
