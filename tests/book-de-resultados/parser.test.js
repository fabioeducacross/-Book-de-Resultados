'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');

const {
  parseSpreadsheet,
  detectWorkbookLayout,
  inferMetadataFromFilePath,
  normalizePercent,
  percentageToStudentCount,
} = require('../../packages/book-de-resultados/src/parser');

describe('parser helpers', () => {
  test('detects legacy workbook layout', () => {
    const workbook = {
      worksheets: [
        { name: 'metadata' },
        { name: 'escolas' },
        { name: 'resultados' },
        { name: 'distribuicao' },
      ],
    };

    expect(detectWorkbookLayout(workbook)).toBe('legacy-4-abas');
  });

  test('detects Canoas workbook layout', () => {
    const workbook = {
      worksheets: [{ name: 'Proficiências' }, { name: 'Habilidades' }],
    };

    expect(detectWorkbookLayout(workbook)).toBe('canoas-avaliacao-digital');
  });

  test('infers metadata from the real file name pattern', () => {
    const inferred = inferMetadataFromFilePath(
      'C:/tmp/[CANOAS 2025 - 2 Semestre] Proficiência por escola.xlsx',
    );

    expect(inferred.municipio).toBe('CANOAS');
    expect(inferred.ano).toBe('2025');
    expect(inferred.ciclo).toBe('2025-sem2');
  });

  test('normalizes fractional percentages', () => {
    expect(normalizePercent(0.1554)).toBe(15.54);
    expect(normalizePercent(12.67)).toBe(12.67);
  });

  test('converts percentage to student count', () => {
    expect(percentageToStudentCount(200, 12.5)).toBe(25);
  });
});

describe('parseSpreadsheet()', () => {
  function addValidCanoasMetadataSheet(workbook) {
    const proficiencias = workbook.addWorksheet('Proficiências');
    proficiencias.getCell('C2').value = 'Nome da rede';
    proficiencias.getCell('D2').value = 'Canoas';
    proficiencias.getCell('C3').value = 'Qtd. de escolas';
    proficiencias.getCell('D3').value = 1;
    proficiencias.getCell('C4').value = 'Alunos que iniciaram';
    proficiencias.getCell('D4').value = 120;
    proficiencias.getCell('C5').value = 'Alunos que finalizaram';
    proficiencias.getCell('D5').value = 100;
    proficiencias.getCell('C6').value = 'Alunos previstos';
    proficiencias.getCell('D6').value = 100;
    return proficiencias;
  }

  function addValidCanoasSchoolTable(sheet) {
    sheet.getCell('A15').value = 'Responsável';
    sheet.getCell('B15').value = 'Status';
    sheet.getCell('C15').value = 'Escola';
    sheet.getCell('D15').value = 'Alunos que iniciaram';
    sheet.getCell('E15').value = 'Alunos que finalizaram';
    sheet.getCell('F15').value = 'Alunos previstos';
    sheet.getCell('G15').value = 'Participação Mat.';
    sheet.getCell('H15').value = 'Participação LP';
    sheet.getCell('I15').value = 'Participação dos alunos matriculados (%)';
    sheet.getCell('J15').value = 'Proficiente + avançado MT';
    sheet.getCell('K15').value = 'Proficiente + avançado\nLP';
    sheet.getCell('M15').value = 'NÃO FIZERAM MT';
    sheet.getCell('N15').value = 'Abaixo do Básico Mat.';
    sheet.getCell('O15').value = 'Básico Mat.';
    sheet.getCell('P15').value = 'Proficiente Mat.';
    sheet.getCell('Q15').value = 'Avançado Mat.';
    sheet.getCell('S15').value = 'NÃO FIZERAM LP';
    sheet.getCell('T15').value = 'Abaixo do Básico LP';
    sheet.getCell('U15').value = 'Básico LP';
    sheet.getCell('V15').value = 'Proficiente LP';
    sheet.getCell('W15').value = 'Avançado LP';

    sheet.getCell('B16').value = 'Feito';
    sheet.getCell('C16').value = 'EMEF Theodoro Bogen';
    sheet.getCell('D16').value = 120;
    sheet.getCell('E16').value = 100;
    sheet.getCell('F16').value = 100;
    sheet.getCell('G16').value = 100;
    sheet.getCell('H16').value = 100;
    sheet.getCell('I16').value = 88.01;
    sheet.getCell('J16').value = 49.65;
    sheet.getCell('K16').value = 47.6;
    sheet.getCell('N16').value = 12.32;
    sheet.getCell('O16').value = 25.34;
    sheet.getCell('P16').value = 23.97;
    sheet.getCell('Q16').value = 25.68;
    sheet.getCell('T16').value = 16.78;
    sheet.getCell('U16').value = 21.23;
    sheet.getCell('V16').value = 25.0;
    sheet.getCell('W16').value = 22.6;
  }

  function addValidCanoasHabilidadesSheet(workbook) {
    const habilidades = workbook.addWorksheet('Habilidades');
    habilidades.addRow([
      'Área de Conhecimento',
      'Ano Escolar',
      'Tag (Código)',
      'Temática',
      'Habilidade',
      'Desempenho (%)',
    ]);
    habilidades.addRow([
      'Língua Portuguesa',
      '3º Ano',
      'LP3A1',
      'Leitura',
      'Localizar informações explícitas em textos.',
      79.67,
    ]);
    return habilidades;
  }

  test('parses the legacy workbook shape', async () => {
    const workbook = new ExcelJS.Workbook();
    const metadata = workbook.addWorksheet('metadata');
    metadata.addRow(['chave', 'valor']);
    metadata.addRow(['municipio', 'Canoas']);
    metadata.addRow(['ano', '2025']);
    metadata.addRow(['ciclo', '2025-sem1']);
    metadata.addRow(['data', '2025-06-01']);

    const escolas = workbook.addWorksheet('escolas');
    escolas.addRow(['id_escola', 'nome_escola']);
    escolas.addRow(['1', 'Escola Alpha']);

    const resultados = workbook.addWorksheet('resultados');
    resultados.addRow(['id_escola', 'ano', 'disciplina', 'media', 'participacao']);
    resultados.addRow(['1', '5', 'Matemática', 250, 90]);

    const distribuicao = workbook.addWorksheet('distribuicao');
    distribuicao.addRow(['id_escola', 'nivel', 'alunos']);
    distribuicao.addRow(['1', 'adequado', 10]);

    const filePath = path.join(os.tmpdir(), `legacy-book-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    try {
      const parsed = await parseSpreadsheet(filePath);
      expect(parsed.metadata.municipio).toBe('Canoas');
      expect(parsed.escolas).toHaveLength(1);
      expect(parsed.resultados).toHaveLength(1);
      expect(parsed.distribuicao).toHaveLength(1);
      expect(parsed.source.layout).toBe('legacy-4-abas');
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  test('parses the real Canoas workbook shape into the canonical contract', async () => {
    const workbook = new ExcelJS.Workbook();

    const proficiencias = addValidCanoasMetadataSheet(workbook);
    addValidCanoasSchoolTable(proficiencias);
    addValidCanoasHabilidadesSheet(workbook);

    const filePath = path.join(os.tmpdir(), `[CANOAS 2025 - 2 Semestre] Proficiência por escola-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    try {
      const parsed = await parseSpreadsheet(filePath);

      expect(parsed.metadata.municipio).toBe('Canoas');
      expect(parsed.metadata.ano).toBe('2025');
      expect(parsed.metadata.ciclo).toBe('2025-sem2');

      expect(parsed.escolas).toHaveLength(1);
      expect(parsed.escolas[0].id_escola).toBe('emef_theodoro_bogen');

      expect(parsed.resultados).toHaveLength(2);
      expect(parsed.resultados[0]).toMatchObject({
        id_escola: 'emef_theodoro_bogen',
        ano: 'Geral',
      });
      expect(parsed.resultados.map((item) => item.disciplina)).toEqual(
        expect.arrayContaining(['Matemática', 'Língua Portuguesa']),
      );

      expect(parsed.distribuicao).toHaveLength(8);
      expect(parsed.distribuicao.find((item) => item.disciplina === 'Matemática' && item.nivel === 'abaixo_do_basico').alunos).toBe(12);
      expect(parsed.distribuicao.find((item) => item.disciplina === 'Matemática' && item.nivel === 'abaixo_do_basico').percentual).toBe(12.32);
      expect(parsed.habilidades).toHaveLength(1);
      expect(parsed.habilidades[0].codigo_habilidade).toBe('LP3A1');
      expect(parsed.source.layout).toBe('canoas-avaliacao-digital');
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  test('parses day-month skill percentages that Excel coerced into date cells', async () => {
    const workbook = new ExcelJS.Workbook();

    const proficiencias = addValidCanoasMetadataSheet(workbook);
    addValidCanoasSchoolTable(proficiencias);
    const habilidades = addValidCanoasHabilidadesSheet(workbook);
    habilidades.getCell('F2').value = new Date(Date.UTC(2025, 11, 26));
    habilidades.getCell('F2').numFmt = 'd.m';
    habilidades.addRow([
      'Matemática',
      '6º Ano',
      'MT6A1',
      'Números',
      'Resolver problemas com números naturais.',
      new Date(Date.UTC(2025, 6, 20)),
    ]);
    habilidades.getCell('F3').numFmt = 'dd.mm';

    const filePath = path.join(os.tmpdir(), `[CANOAS 2025 - 2 Semestre] Proficiência por escola-date-percent-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    try {
      const parsed = await parseSpreadsheet(filePath);

      expect(parsed.habilidades).toHaveLength(2);
      expect(parsed.habilidades[0]).toMatchObject({
        codigo_habilidade: 'LP3A1',
        desempenho_percentual: 26.12,
      });
      expect(parsed.habilidades[1]).toMatchObject({
        codigo_habilidade: 'MT6A1',
        desempenho_percentual: 20.07,
      });
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  test('parses the copied Canoas workbook fixture used for layout validation', async () => {
    const filePath = path.join(
      __dirname,
      'fixtures',
      'canoas-2025-sem2',
      '[CANOAS 2025 - 2 Semestre] Proficiência por escola.xlsx',
    );

    const parsed = await parseSpreadsheet(filePath);

    expect(parsed.source.layout).toBe('canoas-avaliacao-digital');
    expect(parsed.metadata.municipio).toBe('Canoas');
    expect(parsed.escolas).toHaveLength(43);
    expect(parsed.habilidades.find((item) => item.codigo_habilidade === 'LP4L1.6')).toMatchObject({
      desempenho_percentual: 26.12,
    });
    expect(parsed.habilidades.find((item) => item.codigo_habilidade === 'LP7A3.1')).toMatchObject({
      desempenho_percentual: 22.12,
    });
    expect(parsed.habilidades.find((item) => item.codigo_habilidade === '6N2.2')).toMatchObject({
      desempenho_percentual: 20.07,
    });
  });

  test('throws a clear error when the Canoas metadata block is incomplete', async () => {
    const workbook = new ExcelJS.Workbook();
    const proficiencias = workbook.addWorksheet('Proficiências');
    proficiencias.getCell('C2').value = 'Nome da rede';
    proficiencias.getCell('D2').value = 'Canoas';
    addValidCanoasHabilidadesSheet(workbook);

    const filePath = path.join(os.tmpdir(), `[CANOAS 2025 - 2 Semestre] Proficiência por escola-incomplete-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    try {
      await expect(parseSpreadsheet(filePath)).rejects.toThrow(/metadados obrigatórios ausentes/i);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  test('throws a clear error when no school rows are found in Proficiências', async () => {
    const workbook = new ExcelJS.Workbook();
    const proficiencias = addValidCanoasMetadataSheet(workbook);
    proficiencias.getCell('A15').value = 'Responsável';
    proficiencias.getCell('B15').value = 'Status';
    proficiencias.getCell('C15').value = 'Escola';
    proficiencias.getCell('F15').value = 'Alunos previstos';
    proficiencias.getCell('G15').value = 'Participação Mat.';
    addValidCanoasHabilidadesSheet(workbook);

    const filePath = path.join(os.tmpdir(), `[CANOAS 2025 - 2 Semestre] Proficiência por escola-no-school-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    try {
      await expect(parseSpreadsheet(filePath)).rejects.toThrow(/nenhuma escola encontrada/i);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  test('throws a clear error when Habilidades is missing required columns', async () => {
    const workbook = new ExcelJS.Workbook();
    const proficiencias = addValidCanoasMetadataSheet(workbook);
    addValidCanoasSchoolTable(proficiencias);

    const habilidades = workbook.addWorksheet('Habilidades');
    habilidades.addRow(['Área de Conhecimento', 'Ano Escolar', 'Tag (Código)', 'Temática', 'Habilidade']);
    habilidades.addRow(['Língua Portuguesa', '3º Ano', 'LP3A1', 'Leitura', 'Localizar informações explícitas em textos.']);

    const filePath = path.join(os.tmpdir(), `[CANOAS 2025 - 2 Semestre] Proficiência por escola-invalid-skills-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    try {
      await expect(parseSpreadsheet(filePath)).rejects.toThrow(/colunas obrigatórias ausentes na aba "Habilidades"/i);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  test('throws a clear error when a required Canoas numeric percentage cell is blank', async () => {
    const workbook = new ExcelJS.Workbook();
    const proficiencias = addValidCanoasMetadataSheet(workbook);
    addValidCanoasSchoolTable(proficiencias);
    proficiencias.getCell('I16').value = '';
    addValidCanoasHabilidadesSheet(workbook);

    const filePath = path.join(os.tmpdir(), `[CANOAS 2025 - 2 Semestre] Proficiência por escola-blank-percent-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    try {
      await expect(parseSpreadsheet(filePath)).rejects.toThrow(/percentual ausente ou inválido.*Participação dos alunos matriculados/i);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  test('throws a clear error when a required Canoas habilidade percentage is invalid', async () => {
    const workbook = new ExcelJS.Workbook();
    const proficiencias = addValidCanoasMetadataSheet(workbook);
    addValidCanoasSchoolTable(proficiencias);
    const habilidades = addValidCanoasHabilidadesSheet(workbook);
    habilidades.getCell('F2').value = 'N/A';

    const filePath = path.join(os.tmpdir(), `[CANOAS 2025 - 2 Semestre] Proficiência por escola-invalid-percent-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    try {
      await expect(parseSpreadsheet(filePath)).rejects.toThrow(/percentual ausente ou inválido.*Desempenho/i);
    } finally {
      fs.unlinkSync(filePath);
    }
  });
});
