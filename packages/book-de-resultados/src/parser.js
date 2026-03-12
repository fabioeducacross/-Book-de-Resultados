'use strict';

/**
 * Parser — Book de Resultados
 *
 * Parses an XLSX spreadsheet into a structured data object
 * following the Book de Resultados data contract.
 *
 * Expected spreadsheet tabs:
 *   - metadata  : key-value pairs (column A = key, column B = value)
 *   - escolas   : id_escola, nome_escola
 *   - resultados: id_escola, ano, disciplina, media, participacao
 *   - distribuicao: id_escola, nivel, alunos
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const LEGACY_LAYOUT = 'legacy-4-abas';
const CANOAS_LAYOUT = 'canoas-avaliacao-digital';

const LEGACY_SHEETS = ['metadata', 'escolas', 'resultados', 'distribuicao'];
const CANOAS_SHEETS = ['proficiencias', 'habilidades'];

const DISCIPLINAS_CANOAS = [
  { key: 'matematica', label: 'Matemática', participationColumn: 7, proxyColumn: 10 },
  { key: 'lingua_portuguesa', label: 'Língua Portuguesa', participationColumn: 8, proxyColumn: 11 },
];

const CANOAS_METADATA_LABEL_ALIASES = {
  nome_rede: ['Nome da rede'],
  qtd_escolas: ['Qtd. de escolas'],
  alunos_iniciaram: ['Alunos que iniciaram'],
  alunos_finalizaram: ['Alunos que finalizaram'],
  alunos_previstos: ['Alunos previstos'],
};

const CANOAS_HABILIDADES_COLUMN_ALIASES = {
  area_conhecimento: ['Área de Conhecimento', 'Area de Conhecimento'],
  ano_escolar: ['Ano Escolar'],
  codigo_habilidade: ['Tag (Código)', 'Tag (Codigo)'],
  tematica: ['Temática', 'Tematica'],
  habilidade: ['Habilidade'],
  desempenho_percentual: ['Desempenho (%)'],
};

const CANOAS_HABILIDADES_REQUIRED_FIELDS = [
  'area_conhecimento',
  'ano_escolar',
  'codigo_habilidade',
  'habilidade',
  'desempenho_percentual',
];

const PROFICIENCY_COLUMNS = {
  matematica: {
    abaixo_do_basico: 14,
    basico: 15,
    adequado: 16,
    avancado: 17,
  },
  lingua_portuguesa: {
    abaixo_do_basico: 20,
    basico: 21,
    adequado: 22,
    avancado: 23,
  },
};

/**
 * Parses a spreadsheet file and returns structured data.
 * @param {string} filePath - Absolute path to the XLSX file
 * @returns {Promise<{metadata: object, escolas: Array, resultados: Array, distribuicao: Array}>}
 */
async function parseSpreadsheet(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const layout = detectWorkbookLayout(workbook);

  if (layout === LEGACY_LAYOUT) {
    return parseLegacyWorkbook(workbook);
  }

  if (layout === CANOAS_LAYOUT) {
    return parseCanoasWorkbook(workbook, filePath);
  }

  throw new Error(
    `Layout de planilha não suportado. Abas encontradas: ${listWorkbookSheetNames(workbook).join(', ')}`,
  );
}

function parseLegacyWorkbook(workbook) {
  const metadata = parseMetadataSheet(workbook);
  const escolas = parseSheetAsRows(workbook, 'escolas');
  const resultados = parseSheetAsRows(workbook, 'resultados');
  const distribuicao = parseSheetAsRows(workbook, 'distribuicao');

  return {
    metadata,
    escolas,
    resultados,
    distribuicao,
    source: {
      layout: LEGACY_LAYOUT,
      sheetMap: Object.fromEntries(LEGACY_SHEETS.map((name) => [name, name])),
    },
  };
}

function parseCanoasWorkbook(workbook, filePath) {
  const proficienciasSheet = getWorksheetByAliases(workbook, ['Proficiências', 'Proficiencias']);
  const habilidadesSheet = getWorksheetByAliases(workbook, ['Habilidades']);

  if (!proficienciasSheet || !habilidadesSheet) {
    throw new Error('Layout Canoas inválido: abas "Proficiências" e "Habilidades" são obrigatórias');
  }

  const metadata = parseCanoasMetadata(proficienciasSheet, filePath);
  const escolaRows = parseCanoasSchoolRows(proficienciasSheet);
  const escolas = buildCanoasEscolas(escolaRows);
  const resultados = buildCanoasResultados(escolaRows);
  const distribuicao = buildCanoasDistribuicao(escolaRows);
  const habilidades = parseCanoasHabilidades(habilidadesSheet);

  return {
    metadata,
    escolas,
    resultados,
    distribuicao,
    habilidades,
    source: {
      layout: CANOAS_LAYOUT,
      sheetMap: {
        proficiencias: proficienciasSheet.name,
        habilidades: habilidadesSheet.name,
      },
      trace: {
        escolas: escolas.length,
        resultados: resultados.length,
        distribuicao: distribuicao.length,
        habilidades: habilidades.length,
      },
    },
  };
}

/**
 * Parses the metadata sheet (key-value pairs).
 * Column A = key, Column B = value.
 * @param {ExcelJS.Workbook} workbook
 * @returns {object}
 */
function parseMetadataSheet(workbook) {
  const sheet = getWorksheetByAliases(workbook, ['metadata']);
  if (!sheet) {
    return {};
  }

  const metadata = {};
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header if present
    const key = getCellValue(row.getCell(1));
    const value = getCellValue(row.getCell(2));
    if (key) {
      metadata[String(key).trim()] = value;
    }
  });

  // Support header row format (first row has 'chave'/'valor' or 'key'/'value')
  const firstRow = sheet.getRow(1);
  const firstCellValue = getCellValue(firstRow.getCell(1));
  if (
    firstCellValue &&
    ['chave', 'key', 'campo', 'field'].includes(String(firstCellValue).toLowerCase().trim())
  ) {
    // Already skipped in eachRow above; no further action needed.
  } else if (firstCellValue) {
    // No header row — parse row 1 as data
    const key = String(firstCellValue).trim();
    const value = getCellValue(firstRow.getCell(2));
    if (key && !metadata[key]) {
      metadata[key] = value;
    }
  }

  return metadata;
}

/**
 * Parses a worksheet with a header row into an array of row objects.
 * First row is treated as the header (column names).
 * @param {ExcelJS.Workbook} workbook
 * @param {string} sheetName
 * @returns {Array<object>}
 */
function parseSheetAsRows(workbook, sheetName) {
  const sheet = getWorksheetByAliases(workbook, [sheetName]);
  if (!sheet) {
    return [];
  }

  const rows = [];
  let headers = null;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      headers = row.values.slice(1).map((h) => (h != null ? String(h).trim() : null));
      return;
    }

    if (!headers) return;

    const rowObj = {};
    headers.forEach((header, colIdx) => {
      if (header) {
        rowObj[header] = getCellValue(row.getCell(colIdx + 1));
      }
    });

    // Skip entirely empty rows
    if (Object.values(rowObj).some((v) => v !== null && v !== undefined && v !== '')) {
      rows.push(rowObj);
    }
  });

  return rows;
}

/**
 * Extracts a plain JavaScript value from an ExcelJS Cell.
 * Handles formula results, rich text, dates, and plain values.
 * @param {ExcelJS.Cell} cell
 * @returns {string|number|boolean|null}
 */
function getCellValue(cell) {
  if (!cell) return null;

  const { value } = cell;

  if (value === null || value === undefined) return null;

  // Formula cell — use result
  if (typeof value === 'object' && value !== null) {
    if ('result' in value) return value.result ?? null;
    if ('richText' in value) return value.richText.map((rt) => rt.text || '').join('');
    if ('text' in value) return value.text;
    if (value instanceof Date) {
      const coercedPercent = coerceShortDateCellToPercentText(cell, value);
      if (coercedPercent !== null) {
        return coercedPercent;
      }
      return value.toISOString().slice(0, 10);
    }
  }

  return value;
}

function coerceShortDateCellToPercentText(cell, value) {
  if (!(value instanceof Date)) {
    return null;
  }

  const normalizedFormat = String(cell.numFmt || '')
    .replace(/\s+/g, '')
    .toLowerCase();

  if (!/^(d|dd)[./-](m|mm)$/.test(normalizedFormat)) {
    return null;
  }

  const day = normalizedFormat.startsWith('dd')
    ? String(value.getUTCDate()).padStart(2, '0')
    : String(value.getUTCDate());
  const month = normalizedFormat.endsWith('mm')
    ? String(value.getUTCMonth() + 1).padStart(2, '0')
    : String(value.getUTCMonth() + 1);

  return `${day}.${month}`;
}

function detectWorkbookLayout(workbook) {
  const sheetNames = listWorkbookSheetNames(workbook).map(normalizeSheetName);

  if (LEGACY_SHEETS.every((sheetName) => sheetNames.includes(sheetName))) {
    return LEGACY_LAYOUT;
  }

  if (CANOAS_SHEETS.every((sheetName) => sheetNames.includes(sheetName))) {
    return CANOAS_LAYOUT;
  }

  return 'unknown';
}

function listWorkbookSheetNames(workbook) {
  return (workbook.worksheets || []).map((sheet) => sheet.name).filter(Boolean);
}

function normalizeSheetName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getWorksheetByAliases(workbook, aliases) {
  const normalizedAliases = aliases.map(normalizeSheetName);

  return (workbook.worksheets || []).find((sheet) => normalizedAliases.includes(normalizeSheetName(sheet.name))) || null;
}

function parseCanoasMetadata(sheet, filePath) {
  const sparseRows = getSparseRows(sheet);
  const valuesByLabel = buildAdjacentLabelMap(sparseRows);

  const missingLabels = Object.entries(CANOAS_METADATA_LABEL_ALIASES)
    .filter(([, aliases]) => resolveAliasValue(valuesByLabel, aliases) === undefined)
    .map(([, aliases]) => `"${aliases[0]}"`);

  if (missingLabels.length > 0) {
    throw new Error(
      `Layout Canoas inválido: metadados obrigatórios ausentes na aba "Proficiências" (${missingLabels.join(', ')})`,
    );
  }

  const inferred = inferMetadataFromFilePath(filePath);
  const dataFallback = inferred.data || getFileModifiedDate(filePath) || new Date().toISOString().slice(0, 10);
  const nomeRede = resolveAliasValue(valuesByLabel, CANOAS_METADATA_LABEL_ALIASES.nome_rede);

  return {
    municipio: String(nomeRede || inferred.municipio || 'Município').trim(),
    ano: inferred.ano || '',
    ciclo: inferred.ciclo || '',
    data: dataFallback,
    nome_rede: nomeRede || null,
    qtd_escolas: parseRequiredNumber(
      resolveAliasValue(valuesByLabel, CANOAS_METADATA_LABEL_ALIASES.qtd_escolas),
      CANOAS_METADATA_LABEL_ALIASES.qtd_escolas[0],
      'na aba "Proficiências"',
    ),
    alunos_iniciaram: parseRequiredNumber(
      resolveAliasValue(valuesByLabel, CANOAS_METADATA_LABEL_ALIASES.alunos_iniciaram),
      CANOAS_METADATA_LABEL_ALIASES.alunos_iniciaram[0],
      'na aba "Proficiências"',
    ),
    alunos_finalizaram: parseRequiredNumber(
      resolveAliasValue(valuesByLabel, CANOAS_METADATA_LABEL_ALIASES.alunos_finalizaram),
      CANOAS_METADATA_LABEL_ALIASES.alunos_finalizaram[0],
      'na aba "Proficiências"',
    ),
    alunos_previstos: parseRequiredNumber(
      resolveAliasValue(valuesByLabel, CANOAS_METADATA_LABEL_ALIASES.alunos_previstos),
      CANOAS_METADATA_LABEL_ALIASES.alunos_previstos[0],
      'na aba "Proficiências"',
    ),
  };
}

function inferMetadataFromFilePath(filePath) {
  const basename = path.basename(filePath || '');
  const yearMatch = basename.match(/(20\d{2})/);
  const semesterMatch = basename.match(/(?:^|[^\d])(1|2)\s*sem(?:estre)?/i);
  const cityMatch = basename.match(/\[([^\]]+)\]/);

  const ano = yearMatch ? yearMatch[1] : '';
  const semestre = semesterMatch ? semesterMatch[1] : '';
  const ciclo = ano && semestre ? `${ano}-sem${semestre}` : '';

  let municipio = '';
  if (cityMatch) {
    const bracketText = cityMatch[1];
    municipio = bracketText.split('-')[0].replace(/\b\d{4}\b.*$/i, '').trim();
  }

  return {
    municipio,
    ano,
    ciclo,
    data: getFileModifiedDate(filePath),
  };
}

function getFileModifiedDate(filePath) {
  try {
    return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function parseCanoasSchoolRows(sheet) {
  const sparseRows = getSparseRows(sheet);
  const headerRow = sparseRows.find((row) => isCanoasSchoolHeaderRow(row));

  if (!headerRow) {
    throw new Error('Layout Canoas inválido: cabeçalho de escolas não encontrado na aba "Proficiências"');
  }

  const schoolRows = [];

  for (const row of sparseRows) {
    if (row.rowNumber <= headerRow.rowNumber) continue;

    const nomeEscola = getRowValue(row, 3);
    if (!nomeEscola || String(nomeEscola).trim() === '') continue;

    const rowContext = `na linha ${row.rowNumber} da aba "Proficiências"`;
    const participantesMatematica = parseRequiredNumber(getRowValue(row, 7), 'Participação Mat.', rowContext);
    const participantesLinguaPortuguesa = parseRequiredNumber(getRowValue(row, 8), 'Participação LP', rowContext);
    const alunosPrevistos = parseRequiredNumber(getRowValue(row, 6), 'Alunos previstos', rowContext);

    schoolRows.push({
      status: getRowValue(row, 2),
      nome_escola: String(nomeEscola).trim(),
      alunos_iniciaram: parseRequiredNumber(getRowValue(row, 4), 'Alunos que iniciaram', rowContext),
      alunos_finalizaram: parseRequiredNumber(getRowValue(row, 5), 'Alunos que finalizaram', rowContext),
      alunos_previstos: alunosPrevistos,
      participantes: {
        matematica: participantesMatematica,
        lingua_portuguesa: participantesLinguaPortuguesa,
      },
      participacao_total: parseRequiredPercent(getRowValue(row, 9), 'Participação dos alunos matriculados (%)', rowContext),
      proxy_media: {
        matematica: parseRequiredPercent(getRowValue(row, 10), 'Proficiente + avançado MT', rowContext),
        lingua_portuguesa: parseRequiredPercent(getRowValue(row, 11), 'Proficiente + avançado LP', rowContext),
      },
      distribuicao_percentual: {
        matematica: {
          abaixo_do_basico: parseRequiredPercent(getRowValue(row, 14), 'Abaixo do Básico Mat.', rowContext),
          basico: parseRequiredPercent(getRowValue(row, 15), 'Básico Mat.', rowContext),
          adequado: parseRequiredPercent(getRowValue(row, 16), 'Proficiente Mat.', rowContext),
          avancado: parseRequiredPercent(getRowValue(row, 17), 'Avançado Mat.', rowContext),
        },
        lingua_portuguesa: {
          abaixo_do_basico: parseRequiredPercent(getRowValue(row, 20), 'Abaixo do Básico LP', rowContext),
          basico: parseRequiredPercent(getRowValue(row, 21), 'Básico LP', rowContext),
          adequado: parseRequiredPercent(getRowValue(row, 22), 'Proficiente LP', rowContext),
          avancado: parseRequiredPercent(getRowValue(row, 23), 'Avançado LP', rowContext),
        },
      },
    });
  }

  if (schoolRows.length === 0) {
    throw new Error('Layout Canoas inválido: nenhuma escola encontrada na aba "Proficiências"');
  }

  return withGeneratedSchoolIds(schoolRows);
}

function isCanoasSchoolHeaderRow(row) {
  const values = row.cells.map((cell) => String(cell.value || '').trim());
  return values.includes('Escola') && values.includes('Alunos previstos') && values.includes('Participação Mat.');
}

function withGeneratedSchoolIds(rows) {
  const seen = new Map();

  return rows.map((row) => {
    const baseId = slugify(row.nome_escola);
    const count = (seen.get(baseId) || 0) + 1;
    seen.set(baseId, count);

    return {
      ...row,
      id_escola: count === 1 ? baseId : `${baseId}_${count}`,
    };
  });
}

function buildCanoasEscolas(schoolRows) {
  return schoolRows.map((row) => ({
    id_escola: row.id_escola,
    nome_escola: row.nome_escola,
    alunos_iniciaram: row.alunos_iniciaram,
    alunos_finalizaram: row.alunos_finalizaram,
    alunos_previstos: row.alunos_previstos,
    participacao_total: row.participacao_total,
  }));
}

function buildCanoasResultados(schoolRows) {
  const resultados = [];

  schoolRows.forEach((row) => {
    DISCIPLINAS_CANOAS.forEach((disciplina) => {
      const participantes = row.participantes[disciplina.key];
      const participacao = calculateParticipationPercentage(participantes, row.alunos_previstos);

      resultados.push({
        id_escola: row.id_escola,
        ano: 'Geral',
        disciplina: disciplina.label,
        media: row.proxy_media[disciplina.key],
        participacao,
        participantes,
      });
    });
  });

  return resultados;
}

function buildCanoasDistribuicao(schoolRows) {
  const distribuicao = [];

  schoolRows.forEach((row) => {
    for (const [disciplinaKey, columns] of Object.entries(PROFICIENCY_COLUMNS)) {
      const participantes = row.participantes[disciplinaKey];
      const percentuais = row.distribuicao_percentual[disciplinaKey];

      Object.keys(columns).forEach((nivel) => {
        distribuicao.push({
          id_escola: row.id_escola,
          disciplina: disciplinaKey === 'matematica' ? 'Matemática' : 'Língua Portuguesa',
          nivel,
          alunos: percentageToStudentCount(participantes, percentuais[nivel]),
          percentual: normalizePercent(percentuais[nivel]),
        });
      });
    }
  });

  return distribuicao;
}

function parseCanoasHabilidades(sheet) {
  const headerInfo = findTabularHeaderRow(sheet, CANOAS_HABILIDADES_COLUMN_ALIASES, CANOAS_HABILIDADES_REQUIRED_FIELDS);
  if (!headerInfo) {
    const requiredLabels = CANOAS_HABILIDADES_REQUIRED_FIELDS.map(
      (field) => `"${CANOAS_HABILIDADES_COLUMN_ALIASES[field][0]}"`,
    );
    throw new Error(
      `Layout Canoas inválido: colunas obrigatórias ausentes na aba "Habilidades" (${requiredLabels.join(', ')})`,
    );
  }

  const rows = getTabularRows(sheet, headerInfo.rowNumber);
  const habilidades = rows.map((row, index) => {
    const rowContext = `na linha ${row.__rowNumber || headerInfo.rowNumber + index + 1} da aba "Habilidades"`;
    return {
      area_conhecimento: getValueByAliases(row, CANOAS_HABILIDADES_COLUMN_ALIASES.area_conhecimento) || '',
      ano_escolar: getValueByAliases(row, CANOAS_HABILIDADES_COLUMN_ALIASES.ano_escolar) || '',
      codigo_habilidade: getValueByAliases(row, CANOAS_HABILIDADES_COLUMN_ALIASES.codigo_habilidade) || '',
      tematica: getValueByAliases(row, CANOAS_HABILIDADES_COLUMN_ALIASES.tematica) || '',
      habilidade: getValueByAliases(row, CANOAS_HABILIDADES_COLUMN_ALIASES.habilidade) || '',
      desempenho_percentual: parseRequiredPercent(
        getValueByAliases(row, CANOAS_HABILIDADES_COLUMN_ALIASES.desempenho_percentual),
        CANOAS_HABILIDADES_COLUMN_ALIASES.desempenho_percentual[0],
        rowContext,
      ),
    };
  });

  if (habilidades.length === 0) {
    throw new Error('Layout Canoas inválido: nenhuma habilidade encontrada na aba "Habilidades"');
  }

  return habilidades;
}

function getTabularRows(sheet, headerRowNumber = 1) {
  const rows = [];
  let headers = null;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === headerRowNumber) {
      headers = row.values.slice(1).map((value) => (value != null ? String(value).trim() : null));
      return;
    }

    if (!headers || rowNumber < headerRowNumber) return;

    const rowObj = {};
    headers.forEach((header, index) => {
      if (!header) return;
      rowObj[header] = getCellValue(row.getCell(index + 1));
    });

    if (Object.values(rowObj).some((value) => value !== null && value !== undefined && value !== '')) {
      rowObj.__rowNumber = rowNumber;
      rows.push(rowObj);
    }
  });

  return rows;
}

function findTabularHeaderRow(sheet, aliasMap, requiredFields) {
  let match = null;

  sheet.eachRow((row, rowNumber) => {
    if (match) return;

    const headers = row.values.slice(1).map((value) => (value != null ? String(value).trim() : null));
    const normalizedHeaders = new Set(headers.filter(Boolean).map(normalizeLookupLabel));
    const hasAllRequiredFields = requiredFields.every((field) =>
      (aliasMap[field] || []).some((alias) => normalizedHeaders.has(normalizeLookupLabel(alias))),
    );

    if (hasAllRequiredFields) {
      match = { rowNumber, headers };
    }
  });

  return match;
}

function buildAdjacentLabelMap(sparseRows) {
  const valuesByLabel = new Map();

  sparseRows.forEach((row) => {
    row.cells.forEach((cell, idx) => {
      const label = normalizeLookupLabel(cell.value);
      if (!label) return;
      if (valuesByLabel.has(label)) return;

      const nextCell = row.cells[idx + 1];
      if (nextCell && nextCell.value !== null && nextCell.value !== undefined && String(nextCell.value).trim() !== '') {
        valuesByLabel.set(label, nextCell.value);
      }
    });
  });

  return valuesByLabel;
}

function resolveAliasValue(valuesByLabel, aliases) {
  for (const alias of aliases || []) {
    const key = normalizeLookupLabel(alias);
    if (valuesByLabel.has(key)) {
      return valuesByLabel.get(key);
    }
  }

  return undefined;
}

function getValueByAliases(row, aliases) {
  for (const alias of aliases || []) {
    if (row[alias] !== undefined) {
      return row[alias];
    }
  }

  return undefined;
}

function getSparseRows(sheet) {
  const rows = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      cells.push({
        colNumber,
        value: getCellValue(cell),
      });
    });

    if (cells.length > 0) {
      rows.push({ rowNumber, cells });
    }
  });

  return rows;
}

function getRowValue(row, colNumber) {
  const cell = row.cells.find((entry) => entry.colNumber === colNumber);
  return cell ? cell.value : null;
}

function calculateParticipationPercentage(participants, totalExpected) {
  const participantCount = toNumber(participants);
  const expectedCount = toNumber(totalExpected);

  if (!expectedCount) {
    return 0;
  }

  return round((participantCount / expectedCount) * 100, 1);
}

function percentageToStudentCount(totalStudents, percentual) {
  const total = toNumber(totalStudents);
  const pct = normalizePercent(percentual);

  if (!total || !pct) {
    return 0;
  }

  return Math.max(0, Math.round((total * pct) / 100));
}

function parseRequiredNumber(value, label, context = '') {
  const numeric = parseNumericCell(value);
  if (numeric === null) {
    throw new Error(`Layout Canoas inválido: valor numérico ausente ou inválido para "${label}" ${context}`.trim());
  }
  return numeric;
}

function parseRequiredPercent(value, label, context = '') {
  const numeric = parseNumericCell(value);
  if (numeric === null) {
    throw new Error(`Layout Canoas inválido: percentual ausente ou inválido para "${label}" ${context}`.trim());
  }
  if (numeric > 0 && numeric <= 1) {
    return round(numeric * 100, 2);
  }
  return round(numeric, 2);
}

function parseNumericCell(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const sanitized = text.replace(/\s+/g, '').replace(/%/g, '');
  const normalized = sanitized.includes(',')
    ? sanitized.includes('.')
      ? sanitized.replace(/\./g, '').replace(',', '.')
      : sanitized.replace(',', '.')
    : sanitized;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePercent(value) {
  const numeric = toNumber(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric > 0 && numeric <= 1) {
    return round(numeric * 100, 2);
  }

  return round(numeric, 2);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeLookupLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.:()%]/g, '')
    .trim()
    .toLowerCase();
}

module.exports = {
  parseSpreadsheet,
  parseLegacyWorkbook,
  parseCanoasWorkbook,
  parseMetadataSheet,
  parseSheetAsRows,
  getCellValue,
  detectWorkbookLayout,
  normalizeSheetName,
  inferMetadataFromFilePath,
  normalizePercent,
  percentageToStudentCount,
  calculateParticipationPercentage,
};
