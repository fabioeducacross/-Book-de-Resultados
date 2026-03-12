const ExcelJS = require('exceljs');
const os = require('os');
const path = require('path');

/**
 * Generates a valid Canoas XLSX file in the system temp dir.
 * The file name follows the pattern required by inferMetadataFromFilePath:
 *   [MUNICIPIO YEAR - N Semestre]
 * Returns the absolute path to the created file.
 */
async function makeCanoasXlsx() {
    const wb = new ExcelJS.Workbook();

    // ── Proficiências ────────────────────────────────────────
    const p = wb.addWorksheet('Proficiências');
    p.getCell('C2').value = 'Nome da rede';
    p.getCell('D2').value = 'Canoas';
    p.getCell('C3').value = 'Qtd. de escolas';
    p.getCell('D3').value = 1;
    p.getCell('C4').value = 'Alunos que iniciaram';
    p.getCell('D4').value = 100;
    p.getCell('C5').value = 'Alunos que finalizaram';
    p.getCell('D5').value = 100;
    p.getCell('C6').value = 'Alunos previstos';
    p.getCell('D6').value = 100;
    p.getCell('A15').value = 'Responsável';
    p.getCell('B15').value = 'Status';
    p.getCell('C15').value = 'Escola';
    p.getCell('D15').value = 'Alunos que iniciaram';
    p.getCell('E15').value = 'Alunos que finalizaram';
    p.getCell('F15').value = 'Alunos previstos';
    p.getCell('G15').value = 'Participação Mat.';
    p.getCell('H15').value = 'Participação LP';
    p.getCell('I15').value = 'Participação dos alunos matriculados (%)';
    p.getCell('J15').value = 'Proficiente + avançado MT';
    p.getCell('K15').value = 'Proficiente + avançado LP';
    p.getCell('M15').value = 'NAO FIZERAM MT';
    p.getCell('N15').value = 'Abaixo do Básico Mat.';
    p.getCell('O15').value = 'Básico Mat.';
    p.getCell('P15').value = 'Proficiente Mat.';
    p.getCell('Q15').value = 'Avançado Mat.';
    p.getCell('S15').value = 'NAO FIZERAM LP';
    p.getCell('T15').value = 'Abaixo do Básico LP';
    p.getCell('U15').value = 'Básico LP';
    p.getCell('V15').value = 'Proficiente LP';
    p.getCell('W15').value = 'Avançado LP';
    p.getCell('B16').value = 'Feito';
    p.getCell('C16').value = 'EMEF Theodoro Bogen';
    p.getCell('D16').value = 100;
    p.getCell('E16').value = 100;
    p.getCell('F16').value = 100;
    p.getCell('G16').value = 100;
    p.getCell('H16').value = 100;
    p.getCell('I16').value = 88.01;
    p.getCell('J16').value = 49.65;
    p.getCell('K16').value = 47.6;
    p.getCell('N16').value = 12.32;
    p.getCell('O16').value = 25.34;
    p.getCell('P16').value = 23.97;
    p.getCell('Q16').value = 25.68;
    p.getCell('T16').value = 16.78;
    p.getCell('U16').value = 21.23;
    p.getCell('V16').value = 25.0;
    p.getCell('W16').value = 22.6;

    // ── Habilidades ──────────────────────────────────────────
    const h = wb.addWorksheet('Habilidades');
    h.addRow(['Área de Conhecimento', 'Ano Escolar', 'Tag (Código)', 'Temática', 'Habilidade', 'Desempenho (%)']);
    h.addRow(['Língua Portuguesa', '3º Ano', 'LP3A1', 'Leitura', 'Localizar informações explícitas em textos.', 79.67]);

    // File name MUST include the bracket pattern so inferMetadataFromFilePath
    // can extract municipio/ciclo — without it, the server returns status "Erro"
    const filePath = path.join(
        os.tmpdir(),
        `[CANOAS 2025 - 2 Semestre] Proficiencia por escola - ${Date.now()}.xlsx`,
    );
    await wb.xlsx.writeFile(filePath);
    return filePath;
}

module.exports = { makeCanoasXlsx };
