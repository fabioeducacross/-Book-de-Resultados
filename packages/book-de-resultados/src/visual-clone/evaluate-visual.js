'use strict';

/**
 * evaluate-visual.js — Visual Clone Experiment
 *
 * Implements the visual evaluation algorithm for the visual clone experiment.
 *
 * Scoring formula (per Section 9.6 of the experiment specification):
 *   S = 0.35 × S_pixel + 0.30 × S_ssim + 0.35 × S_layout
 *
 * Where:
 *   S_pixel  — inverted pixelmatch ratio (1 − diffPixels/totalPixels)
 *   S_ssim   — structural similarity index (global and per-region)
 *   S_layout — geometry fidelity: position, size, alignment and occupancy of key blocks
 */

const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const { getVisaoGeralRegions, cropRegion } = require('./regions');

// Divergence type labels (Section 9.5 step 5)
const DIVERGENCE_TYPES = {
  TIPOGRAFIA: 'tipografia',
  ESPACAMENTO: 'espacamento',
  GRID: 'grid',
  CROMIA: 'cromia',
  BLOCO_AUSENTE: 'bloco_ausente',
  BLOCO_EXCESSO: 'bloco_excesso',
  PAGINACAO: 'paginacao',
};

/**
 * Decodes a PNG buffer into { data, width, height }.
 * @param {Buffer} pngBuffer
 * @returns {{ data: Buffer, width: number, height: number }}
 */
function decodePng(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  return { data: Buffer.from(png.data), width: png.width, height: png.height };
}

/**
 * Calculates pixelmatch score between two RGBA buffers of the same size.
 * Returns the ratio of matching pixels (1 = identical, 0 = completely different).
 *
 * @param {Buffer} refData  - Reference RGBA buffer
 * @param {Buffer} renderData - Rendered RGBA buffer
 * @param {number} width
 * @param {number} height
 * @param {{ threshold?: number, includeAA?: boolean }} [opts]
 * @returns {{ score: number, diffPixels: number, totalPixels: number, diffBuffer: Buffer }}
 */
function computePixelScore(refData, renderData, width, height, opts = {}) {
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 0.1;
  const includeAA = typeof opts.includeAA === 'boolean' ? opts.includeAA : false;

  const diffBuffer = Buffer.alloc(width * height * 4);
  const diffPixels = pixelmatch(refData, renderData, diffBuffer, width, height, {
    threshold,
    includeAA,
  });

  const totalPixels = width * height;
  const score = 1 - diffPixels / totalPixels;

  return { score, diffPixels, totalPixels, diffBuffer };
}

/**
 * Calculates the Mean Structural Similarity (SSIM) approximation between two RGBA buffers.
 *
 * This uses an 8×8 window-based luminance comparison, which is a simplified but deterministic
 * implementation suitable for layout fidelity assessment (not a full SSIM implementation).
 *
 * @param {Buffer} refData  - Reference RGBA buffer
 * @param {Buffer} renderData - Rendered RGBA buffer
 * @param {number} width
 * @param {number} height
 * @returns {number} SSIM score in [0, 1]
 */
function computeSsimScore(refData, renderData, width, height) {
  const WINDOW = 8;
  const C1 = 0.01 * 0.01;
  const C2 = 0.03 * 0.03;

  let ssimSum = 0;
  let windowCount = 0;

  for (let y = 0; y + WINDOW <= height; y += WINDOW) {
    for (let x = 0; x + WINDOW <= width; x += WINDOW) {
      let sumX = 0;
      let sumY = 0;
      let sumXX = 0;
      let sumYY = 0;
      let sumXY = 0;
      const n = WINDOW * WINDOW;

      for (let wy = 0; wy < WINDOW; wy++) {
        for (let wx = 0; wx < WINDOW; wx++) {
          const idx = ((y + wy) * width + (x + wx)) * 4;
          // Convert RGBA to luminance using ITU-R BT.601: Y = 0.299×R + 0.587×G + 0.114×B
          const lx = (refData[idx] * 0.299 + refData[idx + 1] * 0.587 + refData[idx + 2] * 0.114) / 255;
          const ly = (renderData[idx] * 0.299 + renderData[idx + 1] * 0.587 + renderData[idx + 2] * 0.114) / 255;
          sumX += lx;
          sumY += ly;
          sumXX += lx * lx;
          sumYY += ly * ly;
          sumXY += lx * ly;
        }
      }

      const muX = sumX / n;
      const muY = sumY / n;
      const sigmaX2 = sumXX / n - muX * muX;
      const sigmaY2 = sumYY / n - muY * muY;
      const sigmaXY = sumXY / n - muX * muY;

      const numerator = (2 * muX * muY + C1) * (2 * sigmaXY + C2);
      const denominator = (muX * muX + muY * muY + C1) * (sigmaX2 + sigmaY2 + C2);

      ssimSum += denominator > 0 ? numerator / denominator : 1;
      windowCount++;
    }
  }

  return windowCount > 0 ? Math.max(0, Math.min(1, ssimSum / windowCount)) : 1;
}

/**
 * Computes the layout score from DOM block metadata.
 *
 * The layout score measures how closely the position, size and spacing of key DOM blocks
 * in the rendered page match expected layout anchors derived from the reference.
 *
 * @param {Array<{id: string, rect: {x: number, y: number, width: number, height: number}}>} expectedBlocks
 *   Array of expected block layout descriptors (relative to page, [0,1] scale).
 * @param {Array<{id: string, rect: {x: number, y: number, width: number, height: number}}>} actualBlocks
 *   Array of actual block layout descriptors measured from the rendered DOM.
 * @returns {{ score: number, blockScores: Array<{id: string, score: number, delta: object}>, penalties: string[] }}
 */
function computeLayoutScore(expectedBlocks, actualBlocks) {
  const blockScores = [];
  const penalties = [];

  const actualMap = new Map((actualBlocks || []).map((b) => [b.id, b]));

  for (const expected of expectedBlocks || []) {
    const actual = actualMap.get(expected.id);

    if (!actual) {
      blockScores.push({ id: expected.id, score: 0, delta: null });
      penalties.push(`${expected.id}: bloco ausente no render`);
      continue;
    }

    const dx = Math.abs(expected.rect.x - actual.rect.x);
    const dy = Math.abs(expected.rect.y - actual.rect.y);
    const dw = Math.abs(expected.rect.width - actual.rect.width);
    const dh = Math.abs(expected.rect.height - actual.rect.height);

    const positionPenalty = Math.min(1, (dx + dy) / 0.10);
    const sizePenalty = Math.min(1, (dw + dh) / 0.15);
    const blockScore = Math.max(0, 1 - 0.5 * positionPenalty - 0.5 * sizePenalty);

    blockScores.push({
      id: expected.id,
      score: Math.round(blockScore * 1000) / 1000,
      delta: {
        dx: Math.round(dx * 1000) / 1000,
        dy: Math.round(dy * 1000) / 1000,
        dw: Math.round(dw * 1000) / 1000,
        dh: Math.round(dh * 1000) / 1000,
      },
    });

    if (positionPenalty > 0.3) {
      penalties.push(`${expected.id}: drift de posição alto (${Math.round(positionPenalty * 100)}%)`);
    }

    if (sizePenalty > 0.3) {
      penalties.push(`${expected.id}: divergência de tamanho alto (${Math.round(sizePenalty * 100)}%)`);
    }
  }

  const avgScore =
    blockScores.length > 0
      ? blockScores.reduce((acc, b) => acc + b.score, 0) / blockScores.length
      : 0;

  return {
    score: Math.round(avgScore * 1000) / 1000,
    blockScores,
    penalties,
  };
}

/**
 * Evaluates visual fidelity between reference and rendered PNG images, per region.
 *
 * @param {Buffer} refPngBuffer - PNG buffer of the reference image (from PDF)
 * @param {Buffer} renderPngBuffer - PNG buffer of the rendered HTML screenshot
 * @param {{
 *   regions?: Array,
 *   layoutBlocks?: { expected: Array, actual: Array },
 *   pixelmatchThreshold?: number
 * }} [opts]
 * @returns {VisualEvaluationResult}
 */
function evaluateVisual(refPngBuffer, renderPngBuffer, opts = {}) {
  const ref = decodePng(refPngBuffer);
  const render = decodePng(renderPngBuffer);

  // Resize render to match reference dimensions if needed (basic crop to minimum)
  const width = Math.min(ref.width, render.width);
  const height = Math.min(ref.height, render.height);

  const refCropped = width === ref.width && height === ref.height
    ? ref.data
    : cropRegion(ref.data, ref.width, ref.height, { x: 0, y: 0, width: width / ref.width, height: height / ref.height }).data;

  const renderCropped = width === render.width && height === render.height
    ? render.data
    : cropRegion(render.data, render.width, render.height, { x: 0, y: 0, width: width / render.width, height: height / render.height }).data;

  // 1. Global pixel comparison
  const pixelResult = computePixelScore(refCropped, renderCropped, width, height, {
    threshold: opts.pixelmatchThreshold,
  });

  // 2. Global SSIM
  const ssimGlobal = computeSsimScore(refCropped, renderCropped, width, height);

  // 3. Per-region analysis
  const regions = opts.regions || getVisaoGeralRegions();
  const regionResults = regions.map((region) => {
    const refRegion = cropRegion(refCropped, width, height, region.rect);
    const renderRegion = cropRegion(renderCropped, width, height, region.rect);

    const rW = Math.min(refRegion.width, renderRegion.width);
    const rH = Math.min(refRegion.height, renderRegion.height);

    const rRefData = rW === refRegion.width && rH === refRegion.height
      ? refRegion.data
      : cropRegion(refRegion.data, refRegion.width, refRegion.height, { x: 0, y: 0, width: rW / refRegion.width, height: rH / refRegion.height }).data;

    const rRenderData = rW === renderRegion.width && rH === renderRegion.height
      ? renderRegion.data
      : cropRegion(renderRegion.data, renderRegion.width, renderRegion.height, { x: 0, y: 0, width: rW / renderRegion.width, height: rH / renderRegion.height }).data;

    const regionPixel = computePixelScore(rRefData, rRenderData, rW, rH, {
      threshold: opts.pixelmatchThreshold,
    });
    const regionSsim = computeSsimScore(rRefData, rRenderData, rW, rH);
    const regionScore = 0.5 * regionPixel.score + 0.5 * regionSsim;

    return {
      id: region.id,
      label: region.label,
      weight: region.weight,
      pixelScore: Math.round(regionPixel.score * 1000) / 1000,
      ssimScore: Math.round(regionSsim * 1000) / 1000,
      combinedScore: Math.round(regionScore * 1000) / 1000,
      diffPixelsRatio: Math.round((1 - regionPixel.score) * 1000) / 1000,
    };
  });

  // Weighted regional SSIM
  const totalWeight = regionResults.reduce((acc, r) => acc + r.weight, 0);
  const ssimWeightedRegional = totalWeight > 0
    ? regionResults.reduce((acc, r) => acc + r.ssimScore * r.weight, 0) / totalWeight
    : ssimGlobal;

  // 4. Layout score
  const layoutBlocks = opts.layoutBlocks || { expected: [], actual: [] };
  const layoutResult = computeLayoutScore(layoutBlocks.expected, layoutBlocks.actual);

  // 5. Final composite score: S = 0.35 × S_pixel + 0.30 × S_ssim + 0.35 × S_layout
  const scorePixel = Math.round(pixelResult.score * 1000) / 1000;
  const scoreSsim = Math.round(ssimWeightedRegional * 1000) / 1000;
  const scoreLayout = layoutResult.score;

  const scoreGlobal = Math.round(
    (0.35 * scorePixel + 0.30 * scoreSsim + 0.35 * scoreLayout) * 1000,
  ) / 1000;

  // 6. Classify divergences
  const divergences = classifyDivergences(regionResults, layoutResult.penalties, scorePixel, scoreSsim);

  return {
    scoreGlobal,
    components: {
      pixel: scorePixel,
      ssim: scoreSsim,
      layout: scoreLayout,
    },
    global: {
      pixelDiffRatio: Math.round((1 - pixelResult.score) * 1000) / 1000,
      totalPixels: pixelResult.totalPixels,
      diffPixels: pixelResult.diffPixels,
      ssim: Math.round(ssimGlobal * 1000) / 1000,
    },
    regions: regionResults,
    layout: layoutResult,
    divergences,
    diffBuffer: pixelResult.diffBuffer,
    dimensions: { width, height },
  };
}

/**
 * Classifies detected divergences into actionable categories.
 * Orders by severity and editorial impact (Section 9.7 of the spec).
 *
 * @param {Array} regionResults
 * @param {string[]} layoutPenalties
 * @param {number} scorePixel
 * @param {number} scoreSsim
 * @returns {Array<{type: string, severity: 'alta'|'media'|'baixa', region: string, description: string}>}
 */
function classifyDivergences(regionResults, layoutPenalties, scorePixel, scoreSsim) {
  const divergences = [];

  // Layout penalties translate to structural divergences
  for (const penalty of layoutPenalties || []) {
    const isAbsent = penalty.includes('ausente');
    const isPosition = penalty.includes('posição') || penalty.includes('drift');
    divergences.push({
      type: isAbsent ? DIVERGENCE_TYPES.BLOCO_AUSENTE : (isPosition ? DIVERGENCE_TYPES.GRID : DIVERGENCE_TYPES.ESPACAMENTO),
      severity: isAbsent ? 'alta' : 'media',
      region: 'layout',
      description: penalty,
    });
  }

  // Per-region divergences by combined score
  for (const region of regionResults) {
    if (region.combinedScore < 0.75) {
      divergences.push({
        type: region.ssimScore < 0.80 ? DIVERGENCE_TYPES.GRID : DIVERGENCE_TYPES.CROMIA,
        severity: region.combinedScore < 0.60 ? 'alta' : 'media',
        region: region.id,
        description: `Região "${region.label}" com score combinado baixo (${region.combinedScore})`,
      });
    }
  }

  // Global chromatic/typography divergences
  if (scoreSsim < 0.85 && scorePixel >= 0.85) {
    divergences.push({
      type: DIVERGENCE_TYPES.CROMIA,
      severity: 'baixa',
      region: 'global',
      description: `Divergência cromática global detectada (SSIM ${scoreSsim})`,
    });
  }

  if (scorePixel < 0.75) {
    divergences.push({
      type: DIVERGENCE_TYPES.TIPOGRAFIA,
      severity: scorePixel < 0.60 ? 'alta' : 'media',
      region: 'global',
      description: `Alta diferença de pixel global (${Math.round((1 - scorePixel) * 100)}% pixels divergentes)`,
    });
  }

  // Sort: alta → media → baixa
  const severityOrder = { alta: 0, media: 1, baixa: 2 };
  divergences.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return divergences;
}

/**
 * Produces a prioritized list of corrections ordered by expected visual impact.
 * Implements the correction prioritization policy from Section 9.7.
 *
 * @param {VisualEvaluationResult} evalResult
 * @returns {Array<{priority: number, action: string, region: string, expectedGain: string}>}
 */
function rankCorrections(evalResult) {
  const corrections = [];
  let priority = 1;

  // 1. Structural blocks first (hero, indicators grid)
  const structuralRegions = ['hero-analitico', 'grade-indicadores'];
  for (const regionId of structuralRegions) {
    const r = (evalResult.regions || []).find((x) => x.id === regionId);
    if (r && r.combinedScore < 0.85) {
      corrections.push({
        priority: priority++,
        action: `Corrigir estrutura macro: ${r.label}`,
        region: regionId,
        currentScore: r.combinedScore,
        expectedGain: 'alto — bloco estrutural prioritário',
      });
    }
  }

  // 2. Absent blocks
  const absentBlocks = (evalResult.divergences || []).filter((d) => d.type === DIVERGENCE_TYPES.BLOCO_AUSENTE);
  for (const d of absentBlocks) {
    corrections.push({
      priority: priority++,
      action: `Adicionar bloco ausente: ${d.description}`,
      region: d.region,
      currentScore: 0,
      expectedGain: 'alto — bloco obrigatório ausente',
    });
  }

  // 3. Rhythm and proportions
  const rhythmRegions = ['painel-distribuicao', 'callout-institucional', 'painel-proficiencia'];
  for (const regionId of rhythmRegions) {
    const r = (evalResult.regions || []).find((x) => x.id === regionId);
    if (r && r.combinedScore < 0.85) {
      corrections.push({
        priority: priority++,
        action: `Ajustar ritmo e proporção: ${r.label}`,
        region: regionId,
        currentScore: r.combinedScore,
        expectedGain: 'médio — ritmo vertical e proporção de painéis',
      });
    }
  }

  // 4. Chromatic and micro-spacing refinements (last)
  const chromaticDivergences = (evalResult.divergences || []).filter(
    (d) => d.type === DIVERGENCE_TYPES.CROMIA || d.type === DIVERGENCE_TYPES.TIPOGRAFIA,
  );
  for (const d of chromaticDivergences) {
    corrections.push({
      priority: priority++,
      action: `Refinar: ${d.description}`,
      region: d.region,
      currentScore: evalResult.components ? evalResult.components.pixel : null,
      expectedGain: 'baixo — refinamento cromático e micro-espaçamento',
    });
  }

  return corrections;
}

module.exports = {
  evaluateVisual,
  computePixelScore,
  computeSsimScore,
  computeLayoutScore,
  classifyDivergences,
  rankCorrections,
  decodePng,
  DIVERGENCE_TYPES,
};
