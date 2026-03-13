'use strict';

/**
 * Tests for the visual clone experiment modules:
 * - regions.js
 * - evaluate-visual.js
 * - experiment-manifest.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// ─── regions.js ─────────────────────────────────────────────────────────────

describe('regions — getVisaoGeralRegions', () => {
  const { getVisaoGeralRegions, cropRegion, VISAO_GERAL_REGIONS } = require('../../packages/book-de-resultados/src/visual-clone/regions');

  test('returns exactly 8 regions', () => {
    expect(getVisaoGeralRegions()).toHaveLength(8);
  });

  test('all regions have required fields', () => {
    for (const region of getVisaoGeralRegions()) {
      expect(region).toHaveProperty('id');
      expect(region).toHaveProperty('label');
      expect(region).toHaveProperty('weight');
      expect(region).toHaveProperty('rect');
      expect(region.rect).toHaveProperty('x');
      expect(region.rect).toHaveProperty('y');
      expect(region.rect).toHaveProperty('width');
      expect(region.rect).toHaveProperty('height');
    }
  });

  test('region ids match the 8 required sections', () => {
    const ids = getVisaoGeralRegions().map((r) => r.id);
    expect(ids).toContain('header-institucional');
    expect(ids).toContain('hero-analitico');
    expect(ids).toContain('grade-indicadores');
    expect(ids).toContain('painel-distribuicao');
    expect(ids).toContain('callout-institucional');
    expect(ids).toContain('painel-proficiencia');
    expect(ids).toContain('painel-resumo-disciplina');
    expect(ids).toContain('rodape-paginacao');
  });

  test('weights sum to approximately 1.0', () => {
    const sum = getVisaoGeralRegions().reduce((acc, r) => acc + r.weight, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  test('all rect coordinates are in [0, 1]', () => {
    for (const region of getVisaoGeralRegions()) {
      const { x, y, width, height } = region.rect;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(x + width).toBeLessThanOrEqual(1.01); // allow tiny float error
      expect(y + height).toBeLessThanOrEqual(1.01);
    }
  });

  test('VISAO_GERAL_REGIONS is the same reference as getVisaoGeralRegions()', () => {
    expect(getVisaoGeralRegions()).toBe(VISAO_GERAL_REGIONS);
  });
});

describe('regions — cropRegion', () => {
  const { cropRegion } = require('../../packages/book-de-resultados/src/visual-clone/regions');

  function makeBuffer(width, height, fill = [255, 0, 0, 255]) {
    const buf = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      buf[i * 4 + 0] = fill[0];
      buf[i * 4 + 1] = fill[1];
      buf[i * 4 + 2] = fill[2];
      buf[i * 4 + 3] = fill[3];
    }
    return buf;
  }

  test('crops full image returns same dimensions', () => {
    const buf = makeBuffer(100, 100);
    const result = cropRegion(buf, 100, 100, { x: 0, y: 0, width: 1, height: 1 });
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.data.length).toBe(100 * 100 * 4);
  });

  test('crops top-left quadrant correctly', () => {
    const buf = makeBuffer(100, 100, [100, 0, 0, 255]);
    const result = cropRegion(buf, 100, 100, { x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.data[0]).toBe(100); // R channel preserved
  });

  test('crop result pixel count equals width × height × 4', () => {
    const buf = makeBuffer(200, 300);
    const result = cropRegion(buf, 200, 300, { x: 0.1, y: 0.2, width: 0.5, height: 0.4 });
    expect(result.data.length).toBe(result.width * result.height * 4);
  });
});

// ─── evaluate-visual.js ─────────────────────────────────────────────────────

describe('evaluate-visual — computePixelScore', () => {
  const { computePixelScore } = require('../../packages/book-de-resultados/src/visual-clone/evaluate-visual');

  function solidBuffer(w, h, rgba) {
    const buf = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      buf[i * 4] = rgba[0];
      buf[i * 4 + 1] = rgba[1];
      buf[i * 4 + 2] = rgba[2];
      buf[i * 4 + 3] = rgba[3];
    }
    return buf;
  }

  test('identical images produce score 1', () => {
    const buf = solidBuffer(50, 50, [128, 128, 128, 255]);
    const result = computePixelScore(buf, buf.slice(0), 50, 50);
    expect(result.score).toBe(1);
    expect(result.diffPixels).toBe(0);
  });

  test('completely different images produce score near 0', () => {
    const ref = solidBuffer(50, 50, [255, 0, 0, 255]);
    const render = solidBuffer(50, 50, [0, 0, 255, 255]);
    const result = computePixelScore(ref, render, 50, 50, { threshold: 0.01 });
    expect(result.score).toBeLessThan(0.5);
    expect(result.diffPixels).toBeGreaterThan(0);
  });

  test('returns diffBuffer of correct length', () => {
    const buf = solidBuffer(30, 30, [100, 100, 100, 255]);
    const result = computePixelScore(buf, buf.slice(0), 30, 30);
    expect(result.diffBuffer.length).toBe(30 * 30 * 4);
  });

  test('totalPixels equals width × height', () => {
    const buf = solidBuffer(40, 60, [0, 255, 0, 255]);
    const result = computePixelScore(buf, buf.slice(0), 40, 60);
    expect(result.totalPixels).toBe(40 * 60);
  });
});

describe('evaluate-visual — computeSsimScore', () => {
  const { computeSsimScore } = require('../../packages/book-de-resultados/src/visual-clone/evaluate-visual');

  function solidBuffer(w, h, rgba) {
    const buf = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      buf.writeUInt8(rgba[0], i * 4);
      buf.writeUInt8(rgba[1], i * 4 + 1);
      buf.writeUInt8(rgba[2], i * 4 + 2);
      buf.writeUInt8(rgba[3], i * 4 + 3);
    }
    return buf;
  }

  test('identical images return SSIM close to 1', () => {
    const buf = solidBuffer(64, 64, [180, 180, 180, 255]);
    const score = computeSsimScore(buf, buf.slice(0), 64, 64);
    expect(score).toBeGreaterThan(0.99);
  });

  test('completely different images return SSIM below 0.5', () => {
    const ref = solidBuffer(64, 64, [255, 255, 255, 255]);
    const render = solidBuffer(64, 64, [0, 0, 0, 255]);
    const score = computeSsimScore(ref, render, 64, 64);
    expect(score).toBeLessThan(0.5);
  });

  test('SSIM is bounded in [0, 1]', () => {
    const ref = solidBuffer(32, 32, [100, 100, 100, 255]);
    const render = solidBuffer(32, 32, [200, 50, 50, 255]);
    const score = computeSsimScore(ref, render, 32, 32);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('evaluate-visual — computeLayoutScore', () => {
  const { computeLayoutScore } = require('../../packages/book-de-resultados/src/visual-clone/evaluate-visual');

  test('identical block layouts return score 1', () => {
    const blocks = [
      { id: 'hero', rect: { x: 0, y: 0, width: 1, height: 0.2 } },
      { id: 'grade', rect: { x: 0, y: 0.2, width: 1, height: 0.1 } },
    ];
    const result = computeLayoutScore(blocks, blocks);
    expect(result.score).toBeGreaterThan(0.99);
    expect(result.blockScores).toHaveLength(2);
  });

  test('absent block produces score 0 for that block', () => {
    const expected = [{ id: 'hero', rect: { x: 0, y: 0, width: 1, height: 0.2 } }];
    const actual = [];
    const result = computeLayoutScore(expected, actual);
    expect(result.blockScores[0].score).toBe(0);
    expect(result.penalties.length).toBeGreaterThan(0);
  });

  test('empty expected blocks returns score 0', () => {
    const result = computeLayoutScore([], []);
    expect(result.score).toBe(0);
  });

  test('large position drift lowers block score significantly', () => {
    const expected = [{ id: 'hero', rect: { x: 0, y: 0, width: 0.5, height: 0.2 } }];
    const actual = [{ id: 'hero', rect: { x: 0.4, y: 0.5, width: 0.5, height: 0.2 } }];
    const result = computeLayoutScore(expected, actual);
    expect(result.blockScores[0].score).toBeLessThanOrEqual(0.5);
  });
});

describe('evaluate-visual — rankCorrections', () => {
  const { rankCorrections, DIVERGENCE_TYPES } = require('../../packages/book-de-resultados/src/visual-clone/evaluate-visual');

  test('returns array of corrections', () => {
    const evalResult = {
      scoreGlobal: 0.75,
      components: { pixel: 0.75, ssim: 0.75, layout: 0.75 },
      global: { pixelDiffRatio: 0.25 },
      regions: [
        { id: 'hero-analitico', label: 'Hero', combinedScore: 0.60, ssimScore: 0.60 },
        { id: 'grade-indicadores', label: 'Grade', combinedScore: 0.55, ssimScore: 0.55 },
      ],
      divergences: [
        { type: DIVERGENCE_TYPES.GRID, severity: 'alta', region: 'hero-analitico', description: 'test' },
      ],
      layout: { penalties: [] },
    };

    const corrections = rankCorrections(evalResult);
    expect(Array.isArray(corrections)).toBe(true);
    expect(corrections.length).toBeGreaterThan(0);
    corrections.forEach((c) => {
      expect(c).toHaveProperty('priority');
      expect(c).toHaveProperty('action');
      expect(c).toHaveProperty('region');
      expect(c).toHaveProperty('expectedGain');
    });
  });

  test('structural regions have higher priority than chromatic corrections', () => {
    const evalResult = {
      scoreGlobal: 0.70,
      components: { pixel: 0.60, ssim: 0.75, layout: 0.75 },
      global: { pixelDiffRatio: 0.40 },
      regions: [
        { id: 'hero-analitico', label: 'Hero', combinedScore: 0.50, ssimScore: 0.50 },
        { id: 'grade-indicadores', label: 'Grade', combinedScore: 0.50, ssimScore: 0.50 },
      ],
      divergences: [
        { type: DIVERGENCE_TYPES.TIPOGRAFIA, severity: 'alta', region: 'global', description: 'Alta diff pixel' },
      ],
      layout: { penalties: [] },
    };

    const corrections = rankCorrections(evalResult);
    // Structural corrections (hero, grade) should come before chromatic
    const heroIdx = corrections.findIndex((c) => c.region === 'hero-analitico');
    const chromIdx = corrections.findIndex((c) => c.region === 'global');
    expect(heroIdx).toBeLessThan(chromIdx);
  });
});

// ─── experiment-manifest.js ──────────────────────────────────────────────────

describe('experiment-manifest — buildExperimentManifest', () => {
  const { buildExperimentManifest, writeExperimentManifest, loadExperimentManifest, appendHistoryEntry, readHistory } = require('../../packages/book-de-resultados/src/visual-clone/experiment-manifest');

  const baseParams = {
    iterationId: 'iter-test-001',
    referenceParams: { pdfPath: '/tmp/ref.pdf', pageIndex: 2, dpi: 150 },
    captureParams: { htmlPath: '/tmp/book.print.html', viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2 },
    evalResult: {
      scoreGlobal: 0.88,
      components: { pixel: 0.90, ssim: 0.85, layout: 0.89 },
      global: { pixelDiffRatio: 0.10, totalPixels: 10000, diffPixels: 1000, ssim: 0.85 },
      regions: [{ id: 'hero-analitico', label: 'Hero', weight: 0.20, pixelScore: 0.90, ssimScore: 0.85, combinedScore: 0.875 }],
      divergences: [],
      layout: { score: 0.89, blockScores: [], penalties: [] },
    },
    corrections: [{ priority: 1, action: 'Fix hero', region: 'hero-analitico', expectedGain: 'alto' }],
  };

  test('returns manifest with required top-level fields', () => {
    const manifest = buildExperimentManifest(baseParams);
    expect(manifest).toHaveProperty('manifestVersion');
    expect(manifest).toHaveProperty('experimentId', 'visual-clone-visao-geral-rede');
    expect(manifest).toHaveProperty('iterationId', 'iter-test-001');
    expect(manifest).toHaveProperty('generatedAt');
    expect(manifest).toHaveProperty('targetPage');
    expect(manifest).toHaveProperty('referenceParams');
    expect(manifest).toHaveProperty('captureParams');
    expect(manifest).toHaveProperty('results');
    expect(manifest).toHaveProperty('divergences');
    expect(manifest).toHaveProperty('corrections');
    expect(manifest).toHaveProperty('artefacts');
  });

  test('results include scoreGlobal and component scores', () => {
    const manifest = buildExperimentManifest(baseParams);
    expect(manifest.results.scoreGlobal).toBe(0.88);
    expect(manifest.results.components).toEqual({ pixel: 0.90, ssim: 0.85, layout: 0.89 });
  });

  test('thresholdsMet flags are computed correctly', () => {
    const manifest = buildExperimentManifest(baseParams);
    const t = manifest.results.thresholdsMet;
    expect(t.globalMin090).toBe(false); // 0.88 < 0.90
    expect(typeof t.layoutMin092).toBe('boolean');
    expect(typeof t.pixelDriftBelow12pct).toBe('boolean');
    expect(typeof t.noCriticalRegionBelow085).toBe('boolean');
  });

  test('scoreDelta is computed when previousScore is provided', () => {
    const manifest = buildExperimentManifest({ ...baseParams, previousScore: 0.80 });
    expect(manifest.results.scoreDelta).toBeCloseTo(0.08, 2);
  });

  test('scoreDelta is null when no previousScore', () => {
    const manifest = buildExperimentManifest(baseParams);
    expect(manifest.results.scoreDelta).toBeNull();
  });

  test('writes and loads manifest from disk', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcexp-test-'));
    const manifestPath = path.join(tmpDir, 'test-manifest.json');

    const manifest = buildExperimentManifest(baseParams);
    writeExperimentManifest(manifest, manifestPath);

    expect(fs.existsSync(manifestPath)).toBe(true);
    const loaded = loadExperimentManifest(manifestPath);
    expect(loaded.iterationId).toBe('iter-test-001');
    expect(loaded.results.scoreGlobal).toBe(0.88);
  });

  test('loadExperimentManifest returns null for non-existent file', () => {
    const result = loadExperimentManifest('/nonexistent/path/manifest.json');
    expect(result).toBeNull();
  });
});

describe('experiment-manifest — history', () => {
  const { appendHistoryEntry, readHistory } = require('../../packages/book-de-resultados/src/visual-clone/experiment-manifest');

  test('appendHistoryEntry and readHistory work correctly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcexp-hist-'));
    const historyPath = path.join(tmpDir, 'history.jsonl');

    appendHistoryEntry(historyPath, { iterationId: 'i1', scoreGlobal: 0.70, scoreDelta: null, generatedAt: '2026-01-01T00:00:00Z' });
    appendHistoryEntry(historyPath, { iterationId: 'i2', scoreGlobal: 0.80, scoreDelta: 0.10, generatedAt: '2026-01-02T00:00:00Z' });

    const entries = readHistory(historyPath);
    expect(entries).toHaveLength(2);
    expect(entries[0].iterationId).toBe('i1');
    expect(entries[1].scoreGlobal).toBe(0.80);
  });

  test('readHistory returns empty array for missing file', () => {
    const entries = readHistory('/nonexistent/path/history.jsonl');
    expect(entries).toEqual([]);
  });
});
