'use strict';

/**
 * Validator — Book de Resultados
 *
 * Validates parsed spreadsheet data against the data contract.
 * Checks required columns, value ranges, referential integrity,
 * and distribution percentages.
 */

const REQUIRED_METADATA_FIELDS = ['municipio', 'ano', 'ciclo', 'data'];
const REQUIRED_ESCOLA_FIELDS = ['id_escola', 'nome_escola'];
const REQUIRED_RESULTADO_FIELDS = ['id_escola', 'ano', 'disciplina', 'media', 'participacao'];
const REQUIRED_DISTRIBUICAO_FIELDS = ['id_escola', 'nivel', 'alunos'];

const VALID_NIVEIS = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];

/**
 * Validates the full parsed data object.
 * @param {object} data - Parsed data with keys: metadata, escolas, resultados, distribuicao
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validate(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data must be a non-null object'], warnings };
  }

  validateMetadata(data.metadata, errors);
  validateEscolas(data.escolas, errors, warnings);

  const escolaIds = new Set(
    (data.escolas || []).map((e) => String(e.id_escola)),
  );

  validateResultados(data.resultados, escolaIds, errors, warnings);
  validateDistribuicao(data.distribuicao, escolaIds, errors, warnings);

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates the metadata section.
 * @param {object} metadata
 * @param {string[]} errors
 */
function validateMetadata(metadata, errors) {
  if (!metadata || typeof metadata !== 'object') {
    errors.push('Aba "metadata" ausente ou inválida');
    return;
  }

  for (const field of REQUIRED_METADATA_FIELDS) {
    const value = metadata[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push(`metadata: campo obrigatório ausente ou vazio — "${field}"`);
    }
  }
}

/**
 * Validates the escolas array.
 * @param {Array} escolas
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function validateEscolas(escolas, errors, warnings) {
  if (!Array.isArray(escolas) || escolas.length === 0) {
    errors.push('Aba "escolas" ausente ou sem registros');
    return;
  }

  const seenIds = new Set();

  escolas.forEach((escola, idx) => {
    for (const field of REQUIRED_ESCOLA_FIELDS) {
      const value = escola[field];
      if (value === undefined || value === null || String(value).trim() === '') {
        errors.push(`escolas[${idx}]: campo obrigatório ausente — "${field}"`);
      }
    }

    const id = String(escola.id_escola);
    if (seenIds.has(id)) {
      errors.push(`escolas: id_escola duplicado — "${id}"`);
    }
    seenIds.add(id);
  });

  if (escolas.length > 500) {
    warnings.push(`escolas: ${escolas.length} escolas excedem o limite recomendado de 500`);
  }
}

/**
 * Validates the resultados array.
 * @param {Array} resultados
 * @param {Set<string>} escolaIds
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function validateResultados(resultados, escolaIds, errors, warnings) {
  if (!Array.isArray(resultados) || resultados.length === 0) {
    errors.push('Aba "resultados" ausente ou sem registros');
    return;
  }

  resultados.forEach((row, idx) => {
    for (const field of REQUIRED_RESULTADO_FIELDS) {
      const value = row[field];
      if (value === undefined || value === null || String(value).trim() === '') {
        errors.push(`resultados[${idx}]: campo obrigatório ausente — "${field}"`);
      }
    }

    const id = String(row.id_escola);
    if (escolaIds.size > 0 && !escolaIds.has(id)) {
      warnings.push(`resultados[${idx}]: id_escola "${id}" não encontrado na aba "escolas"`);
    }

    const media = Number(row.media);
    if (isNaN(media) || media < 0) {
      errors.push(`resultados[${idx}]: "media" deve ser um número não-negativo (valor: ${row.media})`);
    }

    const participacao = Number(row.participacao);
    if (isNaN(participacao) || participacao < 0 || participacao > 100) {
      errors.push(
        `resultados[${idx}]: "participacao" deve estar entre 0 e 100 (valor: ${row.participacao})`,
      );
    }
  });
}

/**
 * Validates the distribuicao array.
 * @param {Array} distribuicao
 * @param {Set<string>} escolaIds
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function validateDistribuicao(distribuicao, escolaIds, errors, warnings) {
  if (!Array.isArray(distribuicao) || distribuicao.length === 0) {
    errors.push('Aba "distribuicao" ausente ou sem registros');
    return;
  }

  distribuicao.forEach((row, idx) => {
    for (const field of REQUIRED_DISTRIBUICAO_FIELDS) {
      const value = row[field];
      if (value === undefined || value === null || String(value).trim() === '') {
        errors.push(`distribuicao[${idx}]: campo obrigatório ausente — "${field}"`);
      }
    }

    const id = String(row.id_escola);
    if (escolaIds.size > 0 && !escolaIds.has(id)) {
      warnings.push(`distribuicao[${idx}]: id_escola "${id}" não encontrado na aba "escolas"`);
    }

    const nivel = row.nivel;
    if (nivel && !VALID_NIVEIS.includes(String(nivel))) {
      errors.push(
        `distribuicao[${idx}]: "nivel" inválido — "${nivel}". Valores aceitos: ${VALID_NIVEIS.join(', ')}`,
      );
    }

    const alunos = Number(row.alunos);
    if (!Number.isInteger(alunos) || alunos < 0) {
      errors.push(`distribuicao[${idx}]: "alunos" deve ser um inteiro não-negativo (valor: ${row.alunos})`);
    }
  });
}

module.exports = { validate, validateMetadata, validateEscolas, validateResultados, validateDistribuicao };
