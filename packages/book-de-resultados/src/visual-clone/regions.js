'use strict';

/**
 * regions.js — Visual Clone Experiment
 *
 * Defines the target regions for the Visão Geral da Rede page and their editorial weights.
 *
 * Coordinates are expressed as relative fractions of the page area [0, 1].
 * Format: { id, label, weight, rect: { x, y, width, height } }
 *
 * The 8 minimum regions are defined per Section 9.3 of the experiment specification.
 * Weights reflect editorial priority; the higher the weight, the more this region
 * matters when computing the overall layout score.
 */

const VISAO_GERAL_REGIONS = [
  {
    id: 'header-institucional',
    label: 'Faixa superior e cabeçalho institucional',
    weight: 0.10,
    rect: { x: 0.0, y: 0.0, width: 1.0, height: 0.07 },
  },
  {
    id: 'hero-analitico',
    label: 'Hero analítico da seção',
    weight: 0.20,
    rect: { x: 0.0, y: 0.07, width: 1.0, height: 0.18 },
  },
  {
    id: 'grade-indicadores',
    label: 'Grade de indicadores',
    weight: 0.15,
    rect: { x: 0.0, y: 0.25, width: 1.0, height: 0.12 },
  },
  {
    id: 'painel-distribuicao',
    label: 'Painel de distribuição',
    weight: 0.15,
    rect: { x: 0.0, y: 0.37, width: 0.55, height: 0.22 },
  },
  {
    id: 'callout-institucional',
    label: 'Callout de leitura institucional',
    weight: 0.10,
    rect: { x: 0.55, y: 0.37, width: 0.45, height: 0.22 },
  },
  {
    id: 'painel-proficiencia',
    label: 'Painel de proficiência',
    weight: 0.15,
    rect: { x: 0.0, y: 0.59, width: 1.0, height: 0.20 },
  },
  {
    id: 'painel-resumo-disciplina',
    label: 'Painel de resumo por disciplina',
    weight: 0.10,
    rect: { x: 0.0, y: 0.79, width: 1.0, height: 0.15 },
  },
  {
    id: 'rodape-paginacao',
    label: 'Rodapé e badge de paginação',
    weight: 0.05,
    rect: { x: 0.0, y: 0.94, width: 1.0, height: 0.06 },
  },
];

/**
 * Returns the canonical region definitions for the Visão Geral da Rede page.
 * @returns {Array<{id: string, label: string, weight: number, rect: {x: number, y: number, width: number, height: number}}>}
 */
function getVisaoGeralRegions() {
  return VISAO_GERAL_REGIONS;
}

/**
 * Crops a pixel buffer (RGBA) to the sub-region defined by relative coordinates.
 *
 * @param {Buffer} buffer - Raw RGBA pixel buffer (row-major, 4 bytes/pixel)
 * @param {number} imgWidth - Full image width in pixels
 * @param {number} imgHeight - Full image height in pixels
 * @param {{ x: number, y: number, width: number, height: number }} relativeRect - Relative [0,1] rect
 * @returns {{ data: Buffer, width: number, height: number }}
 */
function cropRegion(buffer, imgWidth, imgHeight, relativeRect) {
  const x0 = Math.round(relativeRect.x * imgWidth);
  const y0 = Math.round(relativeRect.y * imgHeight);
  const w = Math.max(1, Math.round(relativeRect.width * imgWidth));
  const h = Math.max(1, Math.round(relativeRect.height * imgHeight));

  const x1 = Math.min(x0 + w, imgWidth);
  const y1 = Math.min(y0 + h, imgHeight);
  const outW = x1 - x0;
  const outH = y1 - y0;

  const out = Buffer.alloc(outW * outH * 4);

  for (let row = 0; row < outH; row++) {
    const srcOffset = ((y0 + row) * imgWidth + x0) * 4;
    const dstOffset = row * outW * 4;
    buffer.copy(out, dstOffset, srcOffset, srcOffset + outW * 4);
  }

  return { data: out, width: outW, height: outH };
}

module.exports = {
  getVisaoGeralRegions,
  cropRegion,
  VISAO_GERAL_REGIONS,
};
