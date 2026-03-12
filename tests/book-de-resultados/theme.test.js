'use strict';

/**
 * Tests for the Theme module — Book de Resultados
 */

const {
  DEFAULT_THEME,
  DEFAULT_THEME_PATH,
  loadDefaultTheme,
  loadThemeFromPath,
  createTheme,
  pptxHex,
} = require('../../packages/book-de-resultados/src/theme');

// ─── DEFAULT_THEME shape ──────────────────────────────────────────────────────

describe('DEFAULT_THEME', () => {
  test('is loaded from the versioned YAML config file', () => {
    expect(DEFAULT_THEME_PATH).toMatch(/theme\.tokens\.yaml$/);
    expect(loadDefaultTheme()).toEqual(DEFAULT_THEME);
  });

  test('has a colors section', () => {
    expect(DEFAULT_THEME).toHaveProperty('colors');
  });

  test('has a typography section', () => {
    expect(DEFAULT_THEME).toHaveProperty('typography');
  });

  test('has a spacing section', () => {
    expect(DEFAULT_THEME).toHaveProperty('spacing');
  });

  test('colors.proficiency defines all 4 levels', () => {
    const prof = DEFAULT_THEME.colors.proficiency;
    expect(prof).toHaveProperty('abaixo_do_basico');
    expect(prof).toHaveProperty('basico');
    expect(prof).toHaveProperty('adequado');
    expect(prof).toHaveProperty('avancado');
  });

  test('colors.primary is a CSS hex string', () => {
    expect(DEFAULT_THEME.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test('colors.deltaPositive, deltaNegative, deltaNeutral are defined', () => {
    expect(DEFAULT_THEME.colors.deltaPositive).toBeTruthy();
    expect(DEFAULT_THEME.colors.deltaNegative).toBeTruthy();
    expect(DEFAULT_THEME.colors.deltaNeutral).toBeTruthy();
  });

  test('typography.fontFace is a string', () => {
    expect(typeof DEFAULT_THEME.typography.fontFace).toBe('string');
    expect(DEFAULT_THEME.typography.fontFace).toBe('Montserrat');
    expect(DEFAULT_THEME.typography.bodyFontFace).toBe('Montserrat');
    expect(DEFAULT_THEME.typography.displayFontFace).toBe('Montserrat');
  });

  test('includes semantic institutional brand tokens', () => {
    expect(DEFAULT_THEME.colors.brandPrimary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DEFAULT_THEME.colors.brandSecondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DEFAULT_THEME.colors.brandPurple).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DEFAULT_THEME.colors.brandYellow).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DEFAULT_THEME.colors.brandRed).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test('typography.sizes has required keys', () => {
    const sizes = DEFAULT_THEME.typography.sizes;
    expect(sizes).toHaveProperty('pageTitle');
    expect(sizes).toHaveProperty('body');
    expect(sizes).toHaveProperty('small');
  });
});

// ─── createTheme() ────────────────────────────────────────────────────────────

describe('createTheme()', () => {
  test('returns the default theme when called with no arguments', () => {
    const theme = createTheme();
    expect(theme.colors.primary).toBe(DEFAULT_THEME.colors.primary);
    expect(theme.typography.fontFace).toBe(DEFAULT_THEME.typography.fontFace);
  });

  test('returns the default theme when called with an empty object', () => {
    const theme = createTheme({});
    expect(theme.colors.primary).toBe(DEFAULT_THEME.colors.primary);
  });

  test('accepts a custom base theme before runtime overrides', () => {
    const baseTheme = loadThemeFromPath(DEFAULT_THEME_PATH);
    baseTheme.colors.primary = '#112233';

    const theme = createTheme({ colors: { secondary: '#445566' } }, baseTheme);

    expect(theme.colors.primary).toBe('#112233');
    expect(theme.colors.secondary).toBe('#445566');
  });

  test('deep-merges a color override without losing other colors', () => {
    const theme = createTheme({ colors: { primary: '#0D47A1' } });
    expect(theme.colors.primary).toBe('#0D47A1');
    // Other colors untouched
    expect(theme.colors.secondary).toBe(DEFAULT_THEME.colors.secondary);
    expect(theme.colors.textPrimary).toBe(DEFAULT_THEME.colors.textPrimary);
  });

  test('deep-merges nested proficiency color override', () => {
    const theme = createTheme({ colors: { proficiency: { avancado: '#003366' } } });
    expect(theme.colors.proficiency.avancado).toBe('#003366');
    // Other proficiency levels untouched
    expect(theme.colors.proficiency.adequado).toBe(DEFAULT_THEME.colors.proficiency.adequado);
  });

  test('overrides typography.fontFace', () => {
    const theme = createTheme({ typography: { fontFace: 'Arial' } });
    expect(theme.typography.fontFace).toBe('Arial');
    // Font sizes untouched
    expect(theme.typography.sizes.body).toBe(DEFAULT_THEME.typography.sizes.body);
  });

  test('overrides a single typography size', () => {
    const theme = createTheme({ typography: { sizes: { pageTitle: 24 } } });
    expect(theme.typography.sizes.pageTitle).toBe(24);
    expect(theme.typography.sizes.body).toBe(DEFAULT_THEME.typography.sizes.body);
  });

  test('does NOT mutate DEFAULT_THEME when applying overrides', () => {
    const originalPrimary = DEFAULT_THEME.colors.primary;
    createTheme({ colors: { primary: '#FF0000' } });
    expect(DEFAULT_THEME.colors.primary).toBe(originalPrimary);
  });

  test('does NOT mutate DEFAULT_THEME for nested proficiency overrides', () => {
    const originalAdequado = DEFAULT_THEME.colors.proficiency.adequado;
    createTheme({ colors: { proficiency: { adequado: '#FF0000' } } });
    expect(DEFAULT_THEME.colors.proficiency.adequado).toBe(originalAdequado);
  });

  test('handles null gracefully (falls back to DEFAULT_THEME)', () => {
    const theme = createTheme(null);
    expect(theme.colors.primary).toBe(DEFAULT_THEME.colors.primary);
  });

  test('handles array gracefully (non-object returns DEFAULT_THEME)', () => {
    const theme = createTheme(['not', 'an', 'object']);
    expect(theme.colors.primary).toBe(DEFAULT_THEME.colors.primary);
  });
});

// ─── pptxHex() ────────────────────────────────────────────────────────────────

describe('pptxHex()', () => {
  test('strips the # prefix', () => {
    expect(pptxHex('#1A237E')).toBe('1A237E');
  });

  test('returns the string unchanged when no # prefix', () => {
    expect(pptxHex('FFFFFF')).toBe('FFFFFF');
  });

  test('handles empty string gracefully', () => {
    expect(pptxHex('')).toBe('000000');
  });

  test('handles null gracefully', () => {
    expect(pptxHex(null)).toBe('000000');
  });

  test('handles undefined gracefully', () => {
    expect(pptxHex(undefined)).toBe('000000');
  });
});
