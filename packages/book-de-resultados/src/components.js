'use strict';

/**
 * Components — Book de Resultados
 *
 * Builds reusable, serializable visual component descriptors consumed by
 * the exporter when rendering pages. Components carry both the data AND the
 * visual metadata (colors, labels, delta formatting) so that the exporter
 * never needs to re-derive them.
 *
 * Component types:
 *   proficiencia      — Color-coded proficiency level breakdown
 *   habilidades_table — Paginated skill table with column definitions
 *   comparativo       — Side-by-side school vs. network comparison with
 *                       signed-delta formatting and color coding
 */

const { DEFAULT_THEME } = require('./theme');
const { NIVEL_LABELS, NIVEL_COLORS } = require('./charts');

// ─── buildProficienciaComponent() ────────────────────────────────────────────

/**
 * Builds a proficiency component descriptor from a distribution object.
 *
 * @param {object} distribuicao - { abaixo_do_basico, basico, adequado, avancado, total, percentuais }
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {boolean} [options.showPercentual=true]
 * @param {boolean} [options.showAlunos=true]
 * @param {object} [theme=DEFAULT_THEME]
 * @returns {ProficienciaComponent}
 */
function buildProficienciaComponent(distribuicao, options, theme) {
  const resolvedTheme = theme || DEFAULT_THEME;
  const { title = 'Distribuição de Proficiência', showPercentual = true, showAlunos = true } = options || {};

  const niveis = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
  const proficiencyColors =
    resolvedTheme.colors && resolvedTheme.colors.proficiency
      ? resolvedTheme.colors.proficiency
      : NIVEL_COLORS;

  const dist = distribuicao || {};
  const total =
    dist.total !== undefined
      ? dist.total
      : niveis.reduce((sum, n) => sum + (dist[n] || 0), 0);

  const bars = niveis.map((nivel) => {
    const alunos = dist[nivel] || 0;
    const pct =
      (dist.percentuais || {})[nivel] !== undefined
        ? (dist.percentuais || {})[nivel]
        : total > 0
          ? Math.round((alunos / total) * 1000) / 10
          : 0;

    return {
      nivel,
      label: NIVEL_LABELS[nivel],
      alunos,
      percentual: pct,
      color: proficiencyColors[nivel] || NIVEL_COLORS[nivel],
      // Normalized bar width (0–100), ready for rendering proportional bars
      barWidth: pct,
    };
  });

  return {
    type: 'proficiencia',
    title,
    total,
    bars,
    showPercentual,
    showAlunos,
  };
}

// ─── buildHabilidadesTable() ──────────────────────────────────────────────────

/** Human-readable column headers */
const HABILIDADE_COLUMN_LABELS = {
  codigo: 'Código',
  descricao: 'Descrição',
  media: 'Média',
  percentualAcerto: '% Acerto',
  nivelEsperado: 'Nível Esperado',
  disciplina: 'Disciplina',
  ano: 'Ano/Série',
  tematica: 'Temática',
  areaId: 'Área',
};

/**
 * Builds a habilidades (skills) table component descriptor.
 * Handles column definitions and page-break metadata so the exporter
 * can split the table across slides automatically.
 *
 * @param {object[]} habilidades - Array of enriched habilidade objects
 * @param {object} [options]
 * @param {string} [options.title='Resultados por Habilidade']
 * @param {string[]} [options.columns] - Column keys to render
 * @param {number} [options.maxRowsPerPage=20]
 * @param {object} [theme=DEFAULT_THEME]
 * @returns {HabilidadesTableComponent}
 */
function buildHabilidadesTable(habilidades, options, theme) {
  const resolvedTheme = theme || DEFAULT_THEME;
  const {
    title = 'Resultados por Habilidade',
    columns = ['codigo', 'descricao', 'percentualAcerto'],
    maxRowsPerPage = 20,
  } = options || {};

  const columnDefs = columns.map((col) => ({
    key: col,
    label: HABILIDADE_COLUMN_LABELS[col] || col,
  }));

  const rows = (habilidades || []).map((h) => ({
    ...h,
    _rowColor: getHabilidadeRowColor(h, resolvedTheme),
  }));

  // Paginate rows for multi-slide rendering
  const pages = [];
  const safeMax = maxRowsPerPage > 0 ? maxRowsPerPage : 20;
  for (let i = 0; i < rows.length; i += safeMax) {
    pages.push(rows.slice(i, i + safeMax));
  }
  if (pages.length === 0) pages.push([]);

  return {
    type: 'habilidades_table',
    title,
    columnDefs,
    rows,
    pages,
    totalRows: rows.length,
    totalPages: pages.length,
  };
}

// ─── buildComparativoComponent() ─────────────────────────────────────────────

/**
 * Builds a school-vs-network comparative component descriptor.
 * Accepts both the flat structure used in renderer pages (participacaoPorDisciplina)
 * and the richer canonical structure from derived.comparativos.escolaVsRede.
 *
 * Input formats accepted:
 *   Flat:   { disciplina, mediaEscola, mediaRede, deltaMedia, participacaoEscola, participacaoRede }
 *   Nested: { disciplina, escola: { media, taxaParticipacao }, rede: { media, taxaParticipacao },
 *              delta: { media, taxaParticipacao } }
 *
 * @param {object[]} comparativos
 * @param {object} [options]
 * @param {string} [options.title='Comparativo Escola vs. Rede']
 * @param {boolean} [options.showDelta=true]
 * @param {boolean} [options.showParticipacao=true]
 * @param {object} [theme=DEFAULT_THEME]
 * @returns {ComparativoComponent}
 */
function buildComparativoComponent(comparativos, options, theme) {
  const resolvedTheme = theme || DEFAULT_THEME;
  const {
    title = 'Comparativo Escola vs. Rede',
    showDelta = true,
    showParticipacao = true,
  } = options || {};

  const colors = (resolvedTheme.colors) || {};

  const rows = (comparativos || []).map((comp) => {
    // Resolve delta values from either format
    const deltaMedia =
      comp.delta != null && comp.delta.media != null
        ? comp.delta.media
        : comp.deltaMedia != null
          ? comp.deltaMedia
          : null;

    const deltaParticipacao =
      comp.delta != null && comp.delta.taxaParticipacao != null
        ? comp.delta.taxaParticipacao
        : comp.deltaParticipacao != null
          ? comp.deltaParticipacao
          : null;

    // Resolve escola values
    const escolaMedia =
      comp.escola != null && comp.escola.media != null
        ? comp.escola.media
        : comp.mediaEscola != null
          ? comp.mediaEscola
          : null;

    const escolaParticipacao =
      comp.escola != null && comp.escola.taxaParticipacao != null
        ? comp.escola.taxaParticipacao
        : comp.participacaoEscola != null
          ? comp.participacaoEscola
          : null;

    // Resolve rede values
    const redeMedia =
      comp.rede != null && comp.rede.media != null
        ? comp.rede.media
        : comp.mediaRede != null
          ? comp.mediaRede
          : null;

    const redeParticipacao =
      comp.rede != null && comp.rede.taxaParticipacao != null
        ? comp.rede.taxaParticipacao
        : comp.participacaoRede != null
          ? comp.participacaoRede
          : null;

    return {
      disciplina: comp.disciplina || '',
      escola: { media: escolaMedia, participacao: escolaParticipacao },
      rede: { media: redeMedia, participacao: redeParticipacao },
      delta: {
        media: deltaMedia,
        participacao: deltaParticipacao,
        mediaColor: getDeltaColor(deltaMedia, colors),
        participacaoColor: getDeltaColor(deltaParticipacao, colors),
        mediaFormatted: formatDelta(deltaMedia),
        participacaoFormatted: formatDelta(deltaParticipacao),
      },
    };
  });

  return {
    type: 'comparativo',
    title,
    showDelta,
    showParticipacao,
    rows,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns the CSS color for a delta value (positive/negative/neutral).
 * @param {number|null} value
 * @param {object} colors - theme.colors
 * @returns {string}
 */
function getDeltaColor(value, colors) {
  if (value == null || !Number.isFinite(Number(value))) {
    return colors.deltaNeutral || '#757575';
  }
  const n = Number(value);
  if (n > 0) return colors.deltaPositive || '#2E7D32';
  if (n < 0) return colors.deltaNegative || '#C62828';
  return colors.deltaNeutral || '#757575';
}

/**
 * Formats a delta value with a leading '+' for positive values.
 * @param {number|null} value
 * @returns {string}
 */
function formatDelta(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return n > 0 ? `+${n}` : String(n);
}

/**
 * Determines a row background color for a habilidade based on % acerto.
 * @param {object} habilidade
 * @param {object} theme
 * @returns {string|null}
 */
function getHabilidadeRowColor(habilidade, theme) {
  const pct = habilidade.percentualAcerto;
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const val = Number(pct);
  const colors =
    theme && theme.colors && theme.colors.proficiency
      ? theme.colors.proficiency
      : NIVEL_COLORS;
  if (val < 25) return colors.abaixo_do_basico;
  if (val < 50) return colors.basico;
  if (val < 75) return colors.adequado;
  return colors.avancado;
}

module.exports = {
  buildProficienciaComponent,
  buildHabilidadesTable,
  buildComparativoComponent,
  // Exposed for testing
  getDeltaColor,
  formatDelta,
  getHabilidadeRowColor,
};
