'use strict';

/**
 * Tests for the Exporter module — Book de Resultados
 * (filename builder and sanitization only; PPTX/JSON export are integration tests)
 */

const { buildOutputFilename, sanitizeFilenameSegment } = require('../../packages/book-de-resultados/src/exporter');

// ─── sanitizeFilenameSegment() ────────────────────────────────────────────────

describe('sanitizeFilenameSegment()', () => {
  test('lowercases the string', () => {
    expect(sanitizeFilenameSegment('Canoas')).toBe('canoas');
  });

  test('removes accents', () => {
    expect(sanitizeFilenameSegment('São Paulo')).toBe('sao_paulo');
    expect(sanitizeFilenameSegment('Übung')).toBe('ubung');
  });

  test('replaces spaces with underscores', () => {
    expect(sanitizeFilenameSegment('hello world')).toBe('hello_world');
  });

  test('replaces special characters with underscores', () => {
    expect(sanitizeFilenameSegment('2025/sem1')).toBe('2025_sem1');
  });

  test('trims leading and trailing underscores', () => {
    expect(sanitizeFilenameSegment('_test_')).toBe('test');
  });

  test('collapses multiple separators into one underscore', () => {
    expect(sanitizeFilenameSegment('hello--world')).toBe('hello_world');
  });
});

// ─── buildOutputFilename() ────────────────────────────────────────────────────

describe('buildOutputFilename()', () => {
  const metadata = { municipio: 'Canoas', ano: '2025', ciclo: '2025-sem2' };

  test('builds correct filename for pptx', () => {
    expect(buildOutputFilename(metadata, 'pptx')).toBe('relatorio_canoas_2025_2025_sem2_v1.pptx');
  });

  test('builds correct filename for json', () => {
    expect(buildOutputFilename(metadata, 'json')).toBe('relatorio_canoas_2025_2025_sem2_v1.json');
  });

  test('uses provided version', () => {
    expect(buildOutputFilename(metadata, 'pptx', 'v3')).toBe('relatorio_canoas_2025_2025_sem2_v3.pptx');
  });

  test('handles municipio with accents', () => {
    const meta = { municipio: 'São Leopoldo', ano: '2025', ciclo: 'sem1' };
    const filename = buildOutputFilename(meta, 'pptx');
    expect(filename).toMatch(/relatorio_sao_leopoldo_2025_sem1_v1\.pptx/);
  });

  test('falls back to defaults when fields are missing', () => {
    const filename = buildOutputFilename({}, 'pptx');
    expect(filename).toBe('relatorio_municipio_ano_ciclo_v1.pptx');
  });
});
