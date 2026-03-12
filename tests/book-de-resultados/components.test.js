'use strict';

/**
 * Tests for the Components module — Book de Resultados
 */

const {
  buildProficienciaComponent,
  buildHabilidadesTable,
  buildComparativoComponent,
  getDeltaColor,
  formatDelta,
  getHabilidadeRowColor,
} = require('../../packages/book-de-resultados/src/components');
const { DEFAULT_THEME, createTheme } = require('../../packages/book-de-resultados/src/theme');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_DISTRIBUICAO = {
  abaixo_do_basico: 5,
  basico: 15,
  adequado: 40,
  avancado: 20,
  total: 80,
  percentuais: { abaixo_do_basico: 6.3, basico: 18.8, adequado: 50.0, avancado: 25.0 },
};

const SAMPLE_HABILIDADES = [
  { id: 'h1', codigo: 'LP01', descricao: 'Identificar temas', percentualAcerto: 75, disciplinaId: 'portugues' },
  { id: 'h2', codigo: 'LP02', descricao: 'Inferir informações', percentualAcerto: 45, disciplinaId: 'portugues' },
  { id: 'h3', codigo: 'MT01', descricao: 'Calcular frações', percentualAcerto: 20, disciplinaId: 'matematica' },
  { id: 'h4', codigo: 'MT02', descricao: 'Resolver equações', percentualAcerto: null, disciplinaId: 'matematica' },
];

// Nested format (canonical comparativos)
const SAMPLE_COMPARATIVOS_NESTED = [
  {
    disciplina: 'Matemática',
    escola: { media: 260, taxaParticipacao: 92 },
    rede: { media: 250, taxaParticipacao: 90 },
    delta: { media: 10, taxaParticipacao: 2 },
  },
  {
    disciplina: 'Português',
    escola: { media: 230, taxaParticipacao: 88 },
    rede: { media: 242, taxaParticipacao: 90 },
    delta: { media: -12, taxaParticipacao: -2 },
  },
];

// Flat format (renderer's participacaoPorDisciplina)
const SAMPLE_COMPARATIVOS_FLAT = [
  {
    disciplina: 'Matemática',
    mediaEscola: 260,
    mediaRede: 250,
    deltaMedia: 10,
    participacaoEscola: 92,
    participacaoRede: 90,
    deltaParticipacao: 2,
  },
  {
    disciplina: 'Português',
    mediaEscola: 230,
    mediaRede: 242,
    deltaMedia: -12,
    participacaoEscola: 88,
    participacaoRede: 90,
    deltaParticipacao: -2,
  },
];

// ─── buildProficienciaComponent() ────────────────────────────────────────────

describe('buildProficienciaComponent()', () => {
  test('returns type "proficiencia"', () => {
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO);
    expect(comp.type).toBe('proficiencia');
  });

  test('has 4 bars — one per proficiency level', () => {
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO);
    expect(comp.bars).toHaveLength(4);
  });

  test('bars are ordered: abaixo_do_basico → basico → adequado → avancado', () => {
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO);
    const niveis = comp.bars.map((b) => b.nivel);
    expect(niveis).toEqual(['abaixo_do_basico', 'basico', 'adequado', 'avancado']);
  });

  test('each bar has nivel, label, alunos, percentual, color, barWidth', () => {
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO);
    comp.bars.forEach((bar) => {
      expect(bar).toHaveProperty('nivel');
      expect(bar).toHaveProperty('label');
      expect(bar).toHaveProperty('alunos');
      expect(bar).toHaveProperty('percentual');
      expect(bar).toHaveProperty('color');
      expect(bar).toHaveProperty('barWidth');
    });
  });

  test('alunos values match the distribution input', () => {
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO);
    const adequado = comp.bars.find((b) => b.nivel === 'adequado');
    expect(adequado.alunos).toBe(40);
  });

  test('percentual values match the distribution percentuais', () => {
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO);
    const adequado = comp.bars.find((b) => b.nivel === 'adequado');
    expect(adequado.percentual).toBe(50.0);
  });

  test('total reflects distribuicao.total', () => {
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO);
    expect(comp.total).toBe(80);
  });

  test('uses custom title from options', () => {
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO, { title: 'Custom Title' });
    expect(comp.title).toBe('Custom Title');
  });

  test('uses theme proficiency colors when provided', () => {
    const theme = createTheme({ colors: { proficiency: { adequado: '#009900' } } });
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO, {}, theme);
    const adequado = comp.bars.find((b) => b.nivel === 'adequado');
    expect(adequado.color).toBe('#009900');
  });

  test('falls back to NIVEL_COLORS when no theme given', () => {
    const comp = buildProficienciaComponent(SAMPLE_DISTRIBUICAO, {}, null);
    comp.bars.forEach((bar) => {
      expect(bar.color).toBeTruthy();
    });
  });

  test('handles null distribuicao gracefully', () => {
    const comp = buildProficienciaComponent(null);
    expect(comp.type).toBe('proficiencia');
    expect(comp.total).toBe(0);
    comp.bars.forEach((bar) => expect(bar.alunos).toBe(0));
  });

  test('computes total when distribuicao.total is absent', () => {
    const dist = { abaixo_do_basico: 10, basico: 20, adequado: 30, avancado: 40 };
    const comp = buildProficienciaComponent(dist);
    expect(comp.total).toBe(100);
  });
});

// ─── buildHabilidadesTable() ──────────────────────────────────────────────────

describe('buildHabilidadesTable()', () => {
  test('returns type "habilidades_table"', () => {
    const comp = buildHabilidadesTable(SAMPLE_HABILIDADES);
    expect(comp.type).toBe('habilidades_table');
  });

  test('totalRows matches input length', () => {
    const comp = buildHabilidadesTable(SAMPLE_HABILIDADES);
    expect(comp.totalRows).toBe(SAMPLE_HABILIDADES.length);
  });

  test('columnDefs default to codigo, descricao, percentualAcerto', () => {
    const comp = buildHabilidadesTable(SAMPLE_HABILIDADES);
    const keys = comp.columnDefs.map((c) => c.key);
    expect(keys).toContain('codigo');
    expect(keys).toContain('descricao');
    expect(keys).toContain('percentualAcerto');
  });

  test('custom columns are respected', () => {
    const comp = buildHabilidadesTable(SAMPLE_HABILIDADES, { columns: ['codigo', 'tematica'] });
    const keys = comp.columnDefs.map((c) => c.key);
    expect(keys).toEqual(['codigo', 'tematica']);
  });

  test('each columnDef has a key and a label', () => {
    const comp = buildHabilidadesTable(SAMPLE_HABILIDADES);
    comp.columnDefs.forEach((col) => {
      expect(col).toHaveProperty('key');
      expect(col).toHaveProperty('label');
    });
  });

  test('rows are paginated by maxRowsPerPage', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ id: `h${i}`, percentualAcerto: 60 }));
    const comp = buildHabilidadesTable(many, { maxRowsPerPage: 20 });
    expect(comp.totalPages).toBe(3);
    expect(comp.pages[0]).toHaveLength(20);
    expect(comp.pages[1]).toHaveLength(20);
    expect(comp.pages[2]).toHaveLength(5);
  });

  test('single page when rows fit within maxRowsPerPage', () => {
    const comp = buildHabilidadesTable(SAMPLE_HABILIDADES, { maxRowsPerPage: 20 });
    expect(comp.totalPages).toBe(1);
  });

  test('empty pages array contains one empty page when no habilidades', () => {
    const comp = buildHabilidadesTable([]);
    expect(comp.totalPages).toBe(1);
    expect(comp.pages[0]).toHaveLength(0);
  });

  test('row color is set based on percentualAcerto', () => {
    const comp = buildHabilidadesTable(SAMPLE_HABILIDADES);
    // LP01: 75% → avancado color
    const avancadoRow = comp.rows.find((r) => r.codigo === 'LP01');
    expect(avancadoRow._rowColor).toBe(DEFAULT_THEME.colors.proficiency.avancado);
    // LP02: 45% → basico color
    const basicoRow = comp.rows.find((r) => r.codigo === 'LP02');
    expect(basicoRow._rowColor).toBe(DEFAULT_THEME.colors.proficiency.basico);
    // MT01: 20% → abaixo_do_basico color
    const abaixoRow = comp.rows.find((r) => r.codigo === 'MT01');
    expect(abaixoRow._rowColor).toBe(DEFAULT_THEME.colors.proficiency.abaixo_do_basico);
    // MT02: null → no color
    const nullRow = comp.rows.find((r) => r.codigo === 'MT02');
    expect(nullRow._rowColor).toBeNull();
  });

  test('uses custom theme colors for row coloring', () => {
    const theme = createTheme({ colors: { proficiency: { avancado: '#336600' } } });
    const comp = buildHabilidadesTable([{ id: 'h1', codigo: 'H1', percentualAcerto: 80 }], {}, theme);
    expect(comp.rows[0]._rowColor).toBe('#336600');
  });

  test('handles null input gracefully', () => {
    const comp = buildHabilidadesTable(null);
    expect(comp.type).toBe('habilidades_table');
    expect(comp.totalRows).toBe(0);
  });
});

// ─── buildComparativoComponent() ─────────────────────────────────────────────

describe('buildComparativoComponent() — nested format', () => {
  test('returns type "comparativo"', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    expect(comp.type).toBe('comparativo');
  });

  test('row count matches input', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    expect(comp.rows).toHaveLength(2);
  });

  test('each row has disciplina, escola, rede, delta', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    comp.rows.forEach((row) => {
      expect(row).toHaveProperty('disciplina');
      expect(row).toHaveProperty('escola');
      expect(row).toHaveProperty('rede');
      expect(row).toHaveProperty('delta');
    });
  });

  test('escola and rede sub-objects have media and participacao', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    const mat = comp.rows.find((r) => r.disciplina === 'Matemática');
    expect(mat.escola.media).toBe(260);
    expect(mat.rede.media).toBe(250);
    expect(mat.escola.participacao).toBe(92);
    expect(mat.rede.participacao).toBe(90);
  });

  test('positive delta formatted with leading "+"', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    const mat = comp.rows.find((r) => r.disciplina === 'Matemática');
    expect(mat.delta.mediaFormatted).toBe('+10');
  });

  test('negative delta formatted without "+"', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    const port = comp.rows.find((r) => r.disciplina === 'Português');
    expect(port.delta.mediaFormatted).toBe('-12');
  });

  test('positive delta gets deltaPositive color', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    const mat = comp.rows.find((r) => r.disciplina === 'Matemática');
    expect(mat.delta.mediaColor).toBe(DEFAULT_THEME.colors.deltaPositive);
  });

  test('negative delta gets deltaNegative color', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    const port = comp.rows.find((r) => r.disciplina === 'Português');
    expect(port.delta.mediaColor).toBe(DEFAULT_THEME.colors.deltaNegative);
  });

  test('null delta formatted as "—"', () => {
    const comp = buildComparativoComponent([
      { disciplina: 'X', escola: { media: null }, rede: { media: 200 }, delta: { media: null } },
    ]);
    expect(comp.rows[0].delta.mediaFormatted).toBe('—');
  });
});

describe('buildComparativoComponent() — flat format', () => {
  test('reads mediaEscola / mediaRede from flat format', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_FLAT);
    const mat = comp.rows.find((r) => r.disciplina === 'Matemática');
    expect(mat.escola.media).toBe(260);
    expect(mat.rede.media).toBe(250);
  });

  test('reads deltaMedia from flat format', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_FLAT);
    const mat = comp.rows.find((r) => r.disciplina === 'Matemática');
    expect(mat.delta.media).toBe(10);
  });

  test('reads participacaoEscola / participacaoRede from flat format', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_FLAT);
    const mat = comp.rows.find((r) => r.disciplina === 'Matemática');
    expect(mat.escola.participacao).toBe(92);
    expect(mat.rede.participacao).toBe(90);
  });
});

describe('buildComparativoComponent() — options and defaults', () => {
  test('uses custom title', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED, { title: 'Comparativo Especial' });
    expect(comp.title).toBe('Comparativo Especial');
  });

  test('showDelta defaults to true', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    expect(comp.showDelta).toBe(true);
  });

  test('showParticipacao defaults to true', () => {
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED);
    expect(comp.showParticipacao).toBe(true);
  });

  test('handles null/empty input gracefully', () => {
    const comp = buildComparativoComponent(null);
    expect(comp.type).toBe('comparativo');
    expect(comp.rows).toHaveLength(0);
  });

  test('uses theme color overrides for deltas', () => {
    const theme = createTheme({ colors: { deltaPositive: '#004400', deltaNegative: '#440000' } });
    const comp = buildComparativoComponent(SAMPLE_COMPARATIVOS_NESTED, {}, theme);
    const mat = comp.rows.find((r) => r.disciplina === 'Matemática');
    expect(mat.delta.mediaColor).toBe('#004400');
    const port = comp.rows.find((r) => r.disciplina === 'Português');
    expect(port.delta.mediaColor).toBe('#440000');
  });
});

// ─── getDeltaColor() ──────────────────────────────────────────────────────────

describe('getDeltaColor()', () => {
  const colors = DEFAULT_THEME.colors;

  test('returns deltaPositive for positive value', () => {
    expect(getDeltaColor(5, colors)).toBe(colors.deltaPositive);
  });

  test('returns deltaNegative for negative value', () => {
    expect(getDeltaColor(-3, colors)).toBe(colors.deltaNegative);
  });

  test('returns deltaNeutral for zero', () => {
    expect(getDeltaColor(0, colors)).toBe(colors.deltaNeutral);
  });

  test('returns deltaNeutral for null', () => {
    expect(getDeltaColor(null, colors)).toBe(colors.deltaNeutral);
  });

  test('returns deltaNeutral for NaN string', () => {
    expect(getDeltaColor('abc', colors)).toBe(colors.deltaNeutral);
  });
});

// ─── formatDelta() ────────────────────────────────────────────────────────────

describe('formatDelta()', () => {
  test('formats positive as "+N"', () => {
    expect(formatDelta(10)).toBe('+10');
  });

  test('formats negative as "-N"', () => {
    expect(formatDelta(-5)).toBe('-5');
  });

  test('formats zero as "0"', () => {
    expect(formatDelta(0)).toBe('0');
  });

  test('formats null as "—"', () => {
    expect(formatDelta(null)).toBe('—');
  });

  test('formats non-numeric string as "—"', () => {
    expect(formatDelta('abc')).toBe('—');
  });
});

// ─── getHabilidadeRowColor() ──────────────────────────────────────────────────

describe('getHabilidadeRowColor()', () => {
  test('returns abaixo_do_basico color for pct < 25', () => {
    const color = getHabilidadeRowColor({ percentualAcerto: 10 }, DEFAULT_THEME);
    expect(color).toBe(DEFAULT_THEME.colors.proficiency.abaixo_do_basico);
  });

  test('returns basico color for 25 ≤ pct < 50', () => {
    const color = getHabilidadeRowColor({ percentualAcerto: 40 }, DEFAULT_THEME);
    expect(color).toBe(DEFAULT_THEME.colors.proficiency.basico);
  });

  test('returns adequado color for 50 ≤ pct < 75', () => {
    const color = getHabilidadeRowColor({ percentualAcerto: 60 }, DEFAULT_THEME);
    expect(color).toBe(DEFAULT_THEME.colors.proficiency.adequado);
  });

  test('returns avancado color for pct ≥ 75', () => {
    const color = getHabilidadeRowColor({ percentualAcerto: 80 }, DEFAULT_THEME);
    expect(color).toBe(DEFAULT_THEME.colors.proficiency.avancado);
  });

  test('returns null when percentualAcerto is null', () => {
    const color = getHabilidadeRowColor({ percentualAcerto: null }, DEFAULT_THEME);
    expect(color).toBeNull();
  });

  test('returns null when percentualAcerto is undefined', () => {
    const color = getHabilidadeRowColor({}, DEFAULT_THEME);
    expect(color).toBeNull();
  });

  test('uses custom theme proficiency colors', () => {
    const theme = createTheme({ colors: { proficiency: { avancado: '#123456' } } });
    const color = getHabilidadeRowColor({ percentualAcerto: 90 }, theme);
    expect(color).toBe('#123456');
  });
});
