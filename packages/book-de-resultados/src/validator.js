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
const REQUIRED_HABILIDADE_FIELDS = [
  'area_conhecimento',
  'ano_escolar',
  'codigo_habilidade',
  'habilidade',
  'desempenho_percentual',
];

const VALID_NIVEIS = ['abaixo_do_basico', 'basico', 'adequado', 'avancado'];
const CANOAS_LAYOUT = 'canoas-avaliacao-digital';
const PARTICIPATION_TOLERANCE = 0.6;

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

  const escolas = Array.isArray(data.escolas) ? data.escolas : [];
  const escolaIds = new Set(escolas.map((e) => String(e.id_escola)));
  const escolaMap = new Map(escolas.map((e) => [String(e.id_escola), e]));

  validateResultados(data.resultados, escolaIds, escolaMap, errors, warnings);
  validateDistribuicao(data.distribuicao, escolaIds, errors, warnings);
  validateHabilidades(data.habilidades, data.source && data.source.layout, errors, warnings);
  validateSemanticConsistency(data, escolaMap, errors, warnings);

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

    validateSchoolOperationalFields(escola, idx, errors);
  });

  if (escolas.length > 500) {
    warnings.push(`escolas: ${escolas.length} escolas excedem o limite recomendado de 500`);
  }
}

/**
 * Validates the resultados array.
 * @param {Array} resultados
 * @param {Set<string>} escolaIds
 * @param {Map<string, object>} escolaMap
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function validateResultados(resultados, escolaIds, escolaMap, errors, warnings) {
  if (!Array.isArray(resultados) || resultados.length === 0) {
    errors.push('Aba "resultados" ausente ou sem registros');
    return;
  }

  const seenKeys = new Set();

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

    const key = [id, String(row.ano || ''), String(row.disciplina || '')]
      .map((value) => value.trim())
      .join('::');
    if (seenKeys.has(key)) {
      errors.push(`resultados[${idx}]: registro duplicado para escola/ano/disciplina — "${key}"`);
    }
    seenKeys.add(key);

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

    if (row.participantes !== undefined && row.participantes !== null && row.participantes !== '') {
      const participantes = Number(row.participantes);
      if (!Number.isInteger(participantes) || participantes < 0) {
        errors.push(
          `resultados[${idx}]: "participantes" deve ser um inteiro não-negativo (valor: ${row.participantes})`,
        );
      }

      const escola = escolaMap.get(id);
      const previstos = escola ? toNullableNumber(escola.alunos_previstos) : null;
      if (previstos !== null && previstos > 0) {
        const participacaoCalculada = round((participantes / previstos) * 100, 1);
        if (Math.abs(participacaoCalculada - participacao) > PARTICIPATION_TOLERANCE) {
          errors.push(
            `resultados[${idx}]: "participacao" (${participacao}) diverge dos "participantes" (${participantes}) e dos "alunos_previstos" (${previstos})`,
          );
        }
      }
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

function validateHabilidades(habilidades, layout, errors, warnings) {
  if (!Array.isArray(habilidades) || habilidades.length === 0) {
    if (layout === CANOAS_LAYOUT) {
      errors.push('Aba "Habilidades" ausente ou sem registros no layout Canoas');
    }
    return;
  }

  habilidades.forEach((row, idx) => {
    for (const field of REQUIRED_HABILIDADE_FIELDS) {
      const value = row[field];
      if (value === undefined || value === null || String(value).trim() === '') {
        errors.push(`habilidades[${idx}]: campo obrigatório ausente — "${field}"`);
      }
    }

    const desempenho = Number(row.desempenho_percentual);
    if (isNaN(desempenho) || desempenho < 0 || desempenho > 100) {
      errors.push(
        `habilidades[${idx}]: "desempenho_percentual" deve estar entre 0 e 100 (valor: ${row.desempenho_percentual})`,
      );
    }

    if (!row.tematica || String(row.tematica).trim() === '') {
      warnings.push(`habilidades[${idx}]: campo opcional vazio — "tematica"`);
    }
  });
}

function validateSemanticConsistency(data, escolaMap, errors, warnings) {
  validateMetadataConsistency(data.metadata, escolaMap, warnings);
  validateDistributionAgainstResults(data.resultados, data.distribuicao, escolaMap, errors, warnings);
}

function validateSchoolOperationalFields(escola, idx, errors) {
  const previstos = toNullableNumber(escola.alunos_previstos);
  const iniciaram = toNullableNumber(escola.alunos_iniciaram);
  const finalizaram = toNullableNumber(escola.alunos_finalizaram);
  const participacaoTotal = toNullableNumber(escola.participacao_total);

  [
    ['alunos_previstos', previstos],
    ['alunos_iniciaram', iniciaram],
    ['alunos_finalizaram', finalizaram],
  ].forEach(([field, value]) => {
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      errors.push(`escolas[${idx}]: "${field}" deve ser um inteiro não-negativo (valor: ${escola[field]})`);
    }
  });

  if (previstos !== null && iniciaram !== null && iniciaram > previstos) {
    errors.push(`escolas[${idx}]: "alunos_iniciaram" (${iniciaram}) excede "alunos_previstos" (${previstos})`);
  }

  if (iniciaram !== null && finalizaram !== null && finalizaram > iniciaram) {
    errors.push(`escolas[${idx}]: "alunos_finalizaram" (${finalizaram}) excede "alunos_iniciaram" (${iniciaram})`);
  }

  if (participacaoTotal !== null && (participacaoTotal < 0 || participacaoTotal > 100)) {
    errors.push(
      `escolas[${idx}]: "participacao_total" deve estar entre 0 e 100 (valor: ${escola.participacao_total})`,
    );
  }
}

function validateMetadataConsistency(metadata, escolaMap, warnings) {
  if (!metadata || typeof metadata !== 'object') {
    return;
  }

  const qtdEscolas = toNullableNumber(metadata.qtd_escolas);
  if (qtdEscolas !== null && qtdEscolas !== escolaMap.size) {
    warnings.push(
      `metadata: "qtd_escolas" (${qtdEscolas}) diverge da aba "escolas" (${escolaMap.size})`,
    );
  }

  const totalFinalizaram = sumFieldValues([...escolaMap.values()], 'alunos_finalizaram');
  const alunosFinalizaram = toNullableNumber(metadata.alunos_finalizaram);
  if (alunosFinalizaram !== null && totalFinalizaram !== null && alunosFinalizaram !== totalFinalizaram) {
    warnings.push(
      `metadata: "alunos_finalizaram" (${alunosFinalizaram}) diverge da soma por escola (${totalFinalizaram})`,
    );
  }

  const totalPrevistos = sumFieldValues([...escolaMap.values()], 'alunos_previstos');
  const alunosPrevistos = toNullableNumber(metadata.alunos_previstos);
  if (alunosPrevistos !== null && totalPrevistos !== null && alunosPrevistos !== totalPrevistos) {
    warnings.push(
      `metadata: "alunos_previstos" (${alunosPrevistos}) diverge da soma por escola (${totalPrevistos})`,
    );
  }
}

function validateDistributionAgainstResults(resultados, distribuicao, escolaMap, errors, warnings) {
  const resultRows = Array.isArray(resultados) ? resultados : [];
  const distributionRows = Array.isArray(distribuicao) ? distribuicao : [];
  const hasDistributionDiscipline = distributionRows.some(
    (row) => row && row.disciplina !== undefined && row.disciplina !== null && String(row.disciplina).trim() !== '',
  );
  const distributionGroups = groupByDistribution(distributionRows, hasDistributionDiscipline);
  const resultGroups = groupResultados(resultRows, hasDistributionDiscipline);

  for (const [key, rows] of resultGroups.entries()) {
    const distributionGroup = distributionGroups.get(key);
    if (!distributionGroup) {
      warnings.push(`distribuicao: ausência de linhas para o resultado "${key}"`);
      continue;
    }

    const totalDistribuicao = distributionGroup.rows.reduce((sum, row) => sum + Number(row.alunos || 0), 0);
    const participantes = rows.length === 1 && rows[0].participantes !== undefined
      ? toNullableNumber(rows[0].participantes)
      : null;
    const escola = escolaMap.get(String(rows[0].id_escola));
    const fallbackFinalizaram = escola ? toNullableNumber(escola.alunos_finalizaram) : null;
    const expectedTotal = participantes !== null ? participantes : distributionGroup.hasDisciplina ? null : fallbackFinalizaram;

    if (expectedTotal !== null) {
      const tolerance = buildCountTolerance(expectedTotal);
      const totalDelta = totalDistribuicao - expectedTotal;
      if (totalDelta > tolerance) {
        errors.push(
          `distribuicao: total (${totalDistribuicao}) inconsistente com a base esperada (${expectedTotal}) para "${key}"`,
        );
      } else if (-totalDelta > tolerance) {
        const explicitPercentualTotal = distributionGroup.explicitPercentTotal;
        if (distributionGroup.hasExplicitPercentual) {
          const percentDelta = Math.abs(explicitPercentualTotal - 100);
          if (percentDelta <= 1.5) {
            errors.push(
              `distribuicao: total (${totalDistribuicao}) inconsistente com a base esperada (${expectedTotal}) para "${key}"`,
            );
          } else {
            warnings.push(
              `distribuicao: cobertura parcial (${round(explicitPercentualTotal, 1)}%) para "${key}" — total observado ${totalDistribuicao} frente à base ${expectedTotal}`,
            );
          }
        } else if ((totalDistribuicao / expectedTotal) < 0.75) {
          errors.push(
            `distribuicao: total (${totalDistribuicao}) inconsistente com a base esperada (${expectedTotal}) para "${key}"`,
          );
        } else {
          warnings.push(
            `distribuicao: total (${totalDistribuicao}) abaixo da base esperada (${expectedTotal}) para "${key}"`,
          );
        }
      }
    }

    if (distributionGroup.hasExplicitPercentual && distributionGroup.explicitPercentTotal > 0) {
      const percentualDelta = Math.abs(distributionGroup.explicitPercentTotal - 100);
      if (percentualDelta > 1.5) {
        warnings.push(
          `distribuicao: percentuais explícitos somam ${round(distributionGroup.explicitPercentTotal, 1)}% para "${key}"`,
        );
      }
    }
  }

  for (const [key] of distributionGroups.entries()) {
    if (!resultGroups.has(key)) {
      warnings.push(`distribuicao: linhas sem resultado correspondente — "${key}"`);
    }
  }
}

function groupResultados(resultados, useDisciplineDimension) {
  const groups = new Map();

  (resultados || []).forEach((row) => {
    const key = buildCoherenceKey(row.id_escola, useDisciplineDimension ? row.disciplina : null);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  });

  return groups;
}

function groupByDistribution(distribuicao, useDisciplineDimension) {
  const groups = new Map();

  (distribuicao || []).forEach((row) => {
    const key = buildCoherenceKey(row.id_escola, useDisciplineDimension ? row.disciplina : null);
    if (!groups.has(key)) {
      groups.set(key, {
        rows: [],
        hasDisciplina: row.disciplina !== undefined && row.disciplina !== null && String(row.disciplina).trim() !== '',
        explicitPercentTotal: 0,
        hasExplicitPercentual: false,
      });
    }

    const group = groups.get(key);
    group.rows.push(row);
    const percentual = toNullableNumber(row.percentual);
    if (percentual !== null) {
      group.explicitPercentTotal += percentual;
      group.hasExplicitPercentual = true;
    }
  });

  return groups;
}

function buildCoherenceKey(idEscola, disciplina) {
  return `${String(idEscola)}::${String(disciplina || '__geral__').trim()}`;
}

function sumFieldValues(items, field) {
  const numeric = (items || [])
    .map((item) => toNullableNumber(item && item[field]))
    .filter((value) => value !== null);

  if (numeric.length === 0) {
    return null;
  }

  return numeric.reduce((sum, value) => sum + value, 0);
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildCountTolerance(total) {
  if (!Number.isFinite(Number(total)) || Number(total) <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(Number(total) * 0.03));
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

module.exports = {
  validate,
  validateMetadata,
  validateEscolas,
  validateResultados,
  validateDistribuicao,
  validateHabilidades,
  validateSemanticConsistency,
};
