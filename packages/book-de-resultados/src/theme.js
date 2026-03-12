'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Theme — Book de Resultados
 *
 * Provides a parametrizable visual theme for the book's rendered output.
 * All colors, typography settings and spacing constants live here so that
 * the exporter and component builders never need hardcoded values.
 *
 * Usage:
 *   const { DEFAULT_THEME, createTheme } = require('./theme');
 *
 *   // Use the default theme as-is
 *   const theme = DEFAULT_THEME;
 *
 *   // Create a custom theme (deep-merges into the default)
 *   const theme = createTheme({ colors: { primary: '#0D47A1' } });
 */

const DEFAULT_THEME_PATH = path.join(__dirname, '..', 'config', 'theme.tokens.yaml');
const DEFAULT_THEME = loadDefaultTheme();

/**
 * Creates a resolved theme by deep-merging `overrides` into DEFAULT_THEME.
 * Only plain objects are merged; arrays and primitives are replaced wholesale.
 *
 * @param {object} [overrides] - Partial theme overrides
 * @returns {object} Resolved theme (never mutates DEFAULT_THEME)
 */
function createTheme(overrides, baseTheme = DEFAULT_THEME) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return deepMerge({}, baseTheme);
  }
  return deepMerge(deepMerge({}, baseTheme), overrides);
}

function loadDefaultTheme() {
  return loadThemeFromPath(DEFAULT_THEME_PATH);
}

function loadThemeFromPath(themePath) {
  const parsedTheme = yaml.load(fs.readFileSync(themePath, 'utf-8'));

  if (!parsedTheme || typeof parsedTheme !== 'object' || Array.isArray(parsedTheme)) {
    throw new Error(`Tema padrão inválido em "${themePath}"`);
  }

  return parsedTheme;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Deep-merges `overrides` into `base`. Both arguments are not mutated.
 * @param {object} base
 * @param {object} overrides
 * @returns {object}
 */
function deepMerge(base, overrides) {
  const result = Object.assign({}, base);
  for (const key of Object.keys(overrides)) {
    const srcVal = overrides[key];
    const baseVal = base[key];

    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      baseVal !== null &&
      baseVal !== undefined &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(baseVal, srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * Returns the hex string without '#' prefix — suitable for pptxgenjs.
 * @param {string} color - CSS hex string (e.g. '#1A237E')
 * @returns {string}
 */
function pptxHex(color) {
  return String(color || '#000000').replace('#', '');
}

module.exports = { DEFAULT_THEME, DEFAULT_THEME_PATH, loadDefaultTheme, loadThemeFromPath, createTheme, pptxHex };
