'use strict';

/**
 * Input Adapter — Book de Resultados
 *
 * Converts JSON payloads from the BackOffice API into the
 * canonical data contract consumed by validator → normalizer → renderer.
 *
 * The BackOffice sends a JSON payload when the user selects data for the book.
 * This adapter normalizes field names, coerces types, and injects source metadata
 * so the downstream pipeline behaves identically to the XLSX path.
 *
 * Contract out (same as parser.js):
 *   { metadata, escolas, resultados, distribuicao, habilidades?, source }
 */

const API_SOURCE_LAYOUT = 'api-json';

/**
 * Field name aliases the BackOffice might use.
 * Maps alternative names → canonical names used by the pipeline.
 */
const METADATA_ALIASES = {
  municipio: ['municipio', 'municipality', 'cidade', 'city'],
  ano: ['ano', 'year'],
  ciclo: ['ciclo', 'cycle', 'semestre', 'semester'],
  data: ['data', 'date', 'data_avaliacao'],
  nome_rede: ['nome_rede', 'rede', 'network_name'],
  qtd_escolas: ['qtd_escolas', 'total_escolas', 'school_count'],
  alunos_previstos: ['alunos_previstos', 'expected_students'],
  alunos_iniciaram: ['alunos_iniciaram', 'started_students'],
  alunos_finalizaram: ['alunos_finalizaram', 'finished_students'],
};

const ESCOLA_ALIASES = {
  id_escola: ['id_escola', 'school_id', 'id'],
  nome_escola: ['nome_escola', 'school_name', 'nome'],
  alunos_previstos: ['alunos_previstos', 'expected_students'],
  alunos_iniciaram: ['alunos_iniciaram', 'started_students'],
  alunos_finalizaram: ['alunos_finalizaram', 'finished_students'],
  participacao_total: ['participacao_total', 'total_participation'],
};

const RESULTADO_ALIASES = {
  id_escola: ['id_escola', 'school_id'],
  ano: ['ano', 'year', 'grade'],
  disciplina: ['disciplina', 'discipline', 'subject'],
  media: ['media', 'average', 'score'],
  participacao: ['participacao', 'participation'],
};

const DISTRIBUICAO_ALIASES = {
  id_escola: ['id_escola', 'school_id'],
  nivel: ['nivel', 'level', 'proficiency_level'],
  alunos: ['alunos', 'students', 'count'],
};

const HABILIDADE_ALIASES = {
  area_conhecimento: ['area_conhecimento', 'knowledge_area', 'area'],
  ano_escolar: ['ano_escolar', 'school_year', 'grade'],
  codigo_habilidade: ['codigo_habilidade', 'skill_code', 'code'],
  tematica: ['tematica', 'theme', 'topic'],
  habilidade: ['habilidade', 'skill', 'description'],
  desempenho_percentual: ['desempenho_percentual', 'performance_percent', 'performance'],
};

/**
 * Adapts a JSON payload from the BackOffice into the canonical data contract.
 *
 * @param {object} payload - Raw JSON from the BackOffice API
 * @returns {{ metadata, escolas, resultados, distribuicao, habilidades, source }}
 * @throws {Error} if the payload is structurally invalid
 */
function adaptJsonPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload inválido: deve ser um objeto JSON não-nulo');
  }

  const metadata = adaptMetadata(payload.metadata || payload.meta || {});
  const escolas = adaptArray(payload.escolas || payload.schools || [], ESCOLA_ALIASES, 'escolas');
  const resultados = adaptArray(
    payload.resultados || payload.results || [],
    RESULTADO_ALIASES,
    'resultados',
  );
  const distribuicao = adaptArray(
    payload.distribuicao || payload.distribution || [],
    DISTRIBUICAO_ALIASES,
    'distribuicao',
  );
  const habilidades = adaptArray(
    payload.habilidades || payload.skills || [],
    HABILIDADE_ALIASES,
    'habilidades',
  );

  coerceNumericFields(resultados, ['media', 'participacao']);
  coerceNumericFields(distribuicao, ['alunos']);
  coerceNumericFields(habilidades, ['desempenho_percentual']);
  coerceNumericFields(escolas, ['alunos_previstos', 'alunos_iniciaram', 'alunos_finalizaram', 'participacao_total']);

  const source = {
    layout: API_SOURCE_LAYOUT,
    sheetMap: {},
    trace: {
      escolas: escolas.length,
      resultados: resultados.length,
      distribuicao: distribuicao.length,
      habilidades: habilidades.length,
    },
    inputType: 'json',
    receivedAt: new Date().toISOString(),
  };

  return {
    metadata,
    escolas,
    resultados,
    distribuicao,
    ...(habilidades.length > 0 ? { habilidades } : {}),
    source,
  };
}

/**
 * Adapts the metadata section, resolving field aliases.
 */
function adaptMetadata(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const result = {};
  for (const [canonical, aliases] of Object.entries(METADATA_ALIASES)) {
    const value = findByAlias(raw, aliases);
    if (value !== undefined) {
      result[canonical] = value;
    }
  }

  // Pass through any extra fields not in the alias map
  for (const [key, value] of Object.entries(raw)) {
    const isKnownAlias = Object.values(METADATA_ALIASES)
      .some((aliases) => aliases.includes(key));
    if (!isKnownAlias && !(key in result)) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Adapts an array of records, resolving field aliases per row.
 */
function adaptArray(rawArray, aliasMap, label) {
  if (!Array.isArray(rawArray)) return [];

  return rawArray.map((row, idx) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`${label}[${idx}]: registro inválido — deve ser um objeto`);
    }

    const result = {};
    for (const [canonical, aliases] of Object.entries(aliasMap)) {
      const value = findByAlias(row, aliases);
      if (value !== undefined) {
        result[canonical] = value;
      }
    }

    // Pass through extra fields
    for (const [key, value] of Object.entries(row)) {
      const isKnownAlias = Object.values(aliasMap)
        .some((aliases) => aliases.includes(key));
      if (!isKnownAlias && !(key in result)) {
        result[key] = value;
      }
    }

    return result;
  });
}

/**
 * Finds a value in an object by trying a list of aliases.
 */
function findByAlias(obj, aliases) {
  for (const alias of aliases) {
    if (alias in obj && obj[alias] !== undefined) {
      return obj[alias];
    }
  }
  return undefined;
}

/**
 * Coerces string values to numbers for known numeric fields.
 */
function coerceNumericFields(rows, fields) {
  for (const row of rows) {
    for (const field of fields) {
      if (field in row && row[field] !== null && row[field] !== undefined) {
        const val = row[field];
        if (typeof val === 'string') {
          const num = Number(val);
          if (!Number.isNaN(num)) {
            row[field] = num;
          }
        }
      }
    }
  }
}

/**
 * Validates the structural shape of a payload before adaptation.
 * Returns fast errors (no deep semantic validation — that's the validator's job).
 *
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePayloadShape(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload deve ser um objeto JSON não-nulo'] };
  }

  const meta = payload.metadata || payload.meta;
  if (!meta || typeof meta !== 'object') {
    errors.push('Campo "metadata" obrigatório ausente');
  }

  const escolas = payload.escolas || payload.schools;
  if (!Array.isArray(escolas) || escolas.length === 0) {
    errors.push('Campo "escolas" obrigatório: array com pelo menos 1 item');
  }

  const resultados = payload.resultados || payload.results;
  if (!Array.isArray(resultados) || resultados.length === 0) {
    errors.push('Campo "resultados" obrigatório: array com pelo menos 1 item');
  }

  const distribuicao = payload.distribuicao || payload.distribution;
  if (!Array.isArray(distribuicao) || distribuicao.length === 0) {
    errors.push('Campo "distribuicao" obrigatório: array com pelo menos 1 item');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  adaptJsonPayload,
  validatePayloadShape,
  API_SOURCE_LAYOUT,
};
