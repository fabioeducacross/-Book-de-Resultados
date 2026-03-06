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

const ExcelJS = require('exceljs');

/**
 * Parses a spreadsheet file and returns structured data.
 * @param {string} filePath - Absolute path to the XLSX file
 * @returns {Promise<{metadata: object, escolas: Array, resultados: Array, distribuicao: Array}>}
 */
async function parseSpreadsheet(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const metadata = parseMetadataSheet(workbook);
  const escolas = parseSheetAsRows(workbook, 'escolas');
  const resultados = parseSheetAsRows(workbook, 'resultados');
  const distribuicao = parseSheetAsRows(workbook, 'distribuicao');

  return { metadata, escolas, resultados, distribuicao };
}

/**
 * Parses the metadata sheet (key-value pairs).
 * Column A = key, Column B = value.
 * @param {ExcelJS.Workbook} workbook
 * @returns {object}
 */
function parseMetadataSheet(workbook) {
  const sheet = workbook.getWorksheet('metadata');
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
  const sheet = workbook.getWorksheet(sheetName);
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
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }

  return value;
}

module.exports = { parseSpreadsheet, parseMetadataSheet, parseSheetAsRows, getCellValue };
