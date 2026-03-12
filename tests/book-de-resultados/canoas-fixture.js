'use strict';

/**
 * Canoas Fixture — Book de Resultados Regression Suite
 *
 * Builds a sanitized / anonymous in-memory ExcelJS workbook that mirrors the
 * real "Avaliação Digital" layout (layout: 'canoas-avaliacao-digital').
 *
 * School names are fictitious; numeric values were chosen so that
 *   Math.round(participantes * pct / 100)
 * always yields a clean integer, keeping the regression deterministic
 * across platforms and Node.js versions.
 *
 * Public exports:
 *   buildCanoasWorkbook()  → Promise<ExcelJS.Workbook>
 *   FIXTURE                → raw fixture constants (metadata / schools / habilidades)
 *   EXPECTED               → pre-computed derived values the pipeline must produce
 */

const ExcelJS = require('exceljs');

// ─── Raw fixture constants ────────────────────────────────────────────────────

/**
 * Network-level metadata written into Proficiências cells C2:D6.
 * Schools and habilidades follow.
 */
const FIXTURE = {
  nomeRede: 'Canoas',
  qtdEscolas: 3,
  alunosIniciaram: 445,
  alunosFinalizaram: 410,
  alunosPrevistos: 480,

  /**
   * Three anonymous schools.
   * Column mapping (row 15 = header, data from row 16):
   *   B  Status
   *   C  Escola
   *   D  Alunos que iniciaram
   *   E  Alunos que finalizaram
   *   F  Alunos previstos
   *   G  Participação Mat.          → participantes.matematica
   *   H  Participação LP            → participantes.lingua_portuguesa
   *   I  Participação dos alunos matriculados (%)
   *   J  Proficiente + avançado MT  → proxy_media.matematica
   *   K  Proficiente + avançado LP  → proxy_media.lingua_portuguesa
   *   N  Abaixo do Básico Mat.      → nivel 'abaixo_do_basico'
   *   O  Básico Mat.                → nivel 'basico'
   *   P  Proficiente Mat.           → nivel 'adequado'
   *   Q  Avançado Mat.              → nivel 'avancado'
   *   T  Abaixo do Básico LP        → nivel 'abaixo_do_basico'
   *   U  Básico LP                  → nivel 'basico'
   *   V  Proficiente LP             → nivel 'adequado'
   *   W  Avançado LP                → nivel 'avancado'
   */
  schools: [
    {
      nome: 'EMEF Escola Alfa',
      iniciaram: 190,
      finalizaram: 180,
      previstos: 200,
      participantesMt: 190,
      participantesLp: 185,
      participacaoTotal: 90.0,
      proxyMediaMt: 52.0,
      proxyMediaLp: 48.0,
      // MT distribution pct → alunos = Math.round(190 × pct / 100)
      mtAbaixo: 10.0,      // → 19
      mtBasico: 20.0,      // → 38
      mtProficiente: 28.0, // → 53  (nivel 'adequado')
      mtAvancado: 24.0,    // → 46
      // LP distribution pct → alunos = Math.round(185 × pct / 100)
      lpAbaixo: 15.0,      // → 28
      lpBasico: 20.0,      // → 37
      lpProficiente: 25.0, // → 46  (nivel 'adequado')
      lpAvancado: 23.0,    // → 43
    },
    {
      nome: 'EMEF Escola Beta',
      iniciaram: 145,
      finalizaram: 130,
      previstos: 160,
      participantesMt: 145,
      participantesLp: 140,
      participacaoTotal: 81.3,
      proxyMediaMt: 44.0,
      proxyMediaLp: 42.0,
      // MT → Math.round(145 × pct / 100)
      mtAbaixo: 15.0,      // → 22
      mtBasico: 25.0,      // → 36
      mtProficiente: 20.0, // → 29
      mtAvancado: 24.0,    // → 35
      // LP → Math.round(140 × pct / 100)
      lpAbaixo: 20.0,      // → 28
      lpBasico: 25.0,      // → 35
      lpProficiente: 18.0, // → 25
      lpAvancado: 24.0,    // → 34
    },
    {
      nome: 'EMEF Escola Gama',
      iniciaram: 110,
      finalizaram: 100,
      previstos: 120,
      participantesMt: 110,
      participantesLp: 105,
      participacaoTotal: 83.3,
      proxyMediaMt: 38.0,
      proxyMediaLp: 36.0,
      // MT → Math.round(110 × pct / 100)
      mtAbaixo: 22.0,      // → 24
      mtBasico: 28.0,      // → 31
      mtProficiente: 18.0, // → 20
      mtAvancado: 20.0,    // → 22
      // LP → Math.round(105 × pct / 100)
      lpAbaixo: 25.0,      // → 26
      lpBasico: 30.0,      // → 32
      lpProficiente: 15.0, // → 16
      lpAvancado: 21.0,    // → 22
    },
  ],

  /**
   * Six skills: LP first (rows 2-4) then MT (rows 5-7) in the Habilidades sheet.
   * Insertion order drives the order of habilidades_disciplina pages in the render.
   */
  habilidades: [
    // Língua Portuguesa — 3º Ano
    { area: 'Língua Portuguesa', ano: '3º Ano', codigo: 'LP3A1', tematica: 'Leitura', habilidade: 'Localizar informações explícitas em textos', desempenho: 68.0 },
    { area: 'Língua Portuguesa', ano: '3º Ano', codigo: 'LP3A2', tematica: 'Escrita', habilidade: 'Identificar características de texto narrativo', desempenho: 55.0 },
    { area: 'Língua Portuguesa', ano: '3º Ano', codigo: 'LP3A3', tematica: 'Compreensão', habilidade: 'Inferir sentido de palavras no contexto', desempenho: 42.0 },
    // Matemática — 5º Ano
    { area: 'Matemática', ano: '5º Ano', codigo: 'MT5A1', tematica: 'Números', habilidade: 'Resolver problemas com adição e subtração', desempenho: 72.0 },
    { area: 'Matemática', ano: '5º Ano', codigo: 'MT5A2', tematica: 'Geometria', habilidade: 'Identificar figuras geométricas planas', desempenho: 48.0 },
    { area: 'Matemática', ano: '5º Ano', codigo: 'MT5A3', tematica: 'Álgebra', habilidade: 'Completar padrões numéricos em sequências', desempenho: 65.0 },
  ],
};

// ─── Pre-computed expected values ─────────────────────────────────────────────

/**
 * Deterministic values the pipeline MUST produce from this fixture.
 * Keep these in sync with the formulas in parser.js and normalizer.js.
 *
 * percentageToStudentCount(total, pct) = Math.round(total * pct / 100)
 * normalizePercent(v) for v ∈ [0,1]: Math.round(v * 10000) / 100
 * calculateParticipationPercentage(participants, previstos)
 *   = normalizePercent(participants / previstos)
 */
const EXPECTED = {
  parse: {
    layout: 'canoas-avaliacao-digital',
    municipio: 'Canoas',       // from D2 cell
    ano: '2025',               // inferred from "[CANOAS 2025 - 2 Semestre]" in filepath
    ciclo: '2025-sem2',        // inferred from "2 Semestre" in filepath
    escolasCount: 3,
    resultadosCount: 6,        // 3 schools × 2 disciplines
    distribuicaoCount: 24,     // 3 schools × 2 disciplines × 4 levels
    habilidadesCount: 6,
    // Math.round(participantesMt=190 × mtAbaixo=10.0 / 100) = 19
    escolaAlfaMtAbaixo: 19,
    // Math.round(participantesLp=185 × lpAvancado=23.0 / 100) = Math.round(42.55) = 43
    escolaAlfaLpAvancado: 43,
  },

  normalize: {
    modelVersion: '2.0',
    totalEscolas: 3,
    // sum of alunos_finalizaram: 180 + 130 + 100 = 410
    totalAlunos: 410,
    // mean of 6 resultados.media: (52+48+44+42+38+36)/6 = 43.333… → round = 43.3
    mediaGeral: 43.3,
    disciplinasCount: 2,
    entitiesEscolasCount: 3,
    entitiesHabilidadesCount: 6,
    // Escola Alfa media = (52+48)/2 = 50.0  → rankingPosition 1
    escolaAlfaRankingPosition: 1,
    // Escola Gama media = (38+36)/2 = 37.0  → rankingPosition 3
    escolaGamaRankingPosition: 3,
    // Network-wide distribuicao total (all 24 rows aggregated):
    //   MT abaixo: 19+22+24=65   MT basico: 38+36+31=105
    //   MT adequado: 53+29+20=102  MT avancado: 46+35+22=103  → MT total = 375
    //   LP abaixo: 28+28+26=82   LP basico: 37+35+32=104
    //   LP adequado: 46+25+16=87  LP avancado: 43+34+22=99    → LP total = 372
    //   grand total = 375 + 372 = 747
    redeDistribuicaoTotal: 747,
  },

  render: {
    // Fixed: capa+apresentacao+sumario = 3
    // chapter 'antes':           capitulo + contexto_avaliacao = 2
    // chapter 'durante':         capitulo + participacao_rede + 2×participacao_rede_tabela + metodologia = 5
    // chapter 'resultados':      capitulo + visao_geral + 2×disciplina + 1×ano
    //                            + 2×ranking + 2×habilidades + 3×(escola+disc) = 15
    // chapter 'proximos_passos': capitulo + proximos_passos = 2
    // total = 3 + 2 + 5 + 15 + 2 = 27
    totalPages: 27,
    chapterKeys: ['antes', 'durante', 'resultados', 'proximos_passos'],
    escolaPagesCount: 3,
    escolaDiscPagesCount: 3,
    habilidadesPagesCount: 2,  // LP page + MT page (3 rows each < 20-row threshold)
    rankingPagesCount: 2,      // one per discipline (3 schools ≤ 25-row pagination threshold)
    sectionSequence: [
      'capa',
      'apresentacao',
      'sumario',
      'capitulo',               // antes
      'contexto_avaliacao',
      'capitulo',               // durante
      'participacao_rede',
      'participacao_rede_tabela',
      'participacao_rede_tabela',
      'metodologia',
      'capitulo',               // resultados
      'visao_geral',
      'resultados_disciplina',  // Matemática  (first in disciplinas array)
      'resultados_disciplina',  // Língua Portuguesa
      'resultados_ano',         // Geral
      'ranking',                // Matemática
      'ranking',                // Língua Portuguesa
      'habilidades_disciplina', // Língua Portuguesa (LP rows inserted first in Habilidades sheet)
      'habilidades_disciplina', // Matemática
      'escola',                 // Alfa
      'escola_disciplinas',     // Alfa
      'escola',                 // Beta
      'escola_disciplinas',     // Beta
      'escola',                 // Gama
      'escola_disciplinas',     // Gama
      'capitulo',               // proximos_passos
      'proximos_passos',
    ],
  },

  charts: {
    // visao_geral: distribution chart + 4 indicator cards
    visaoGeralChartCount: 5,
    // resultados_disciplina: distribution + 2 indicator cards
    resultadosDisciplinaChartCount: 3,
    // ranking: 1 ranking chart
    rankingChartCount: 1,
    // habilidades_disciplina: 2 indicator cards
    habilidadesChartCount: 2,
    // escola (with operacional data): distribution + ranking + 4 operacional indicator cards
    escolaChartCount: 6,
    // escola_disciplinas: ranking indicator + 1 comparativo_chart
    escolaDiscChartCount: 2,
  },

  export: {
    jsonFilename: 'relatorio_canoas_2025_2025_sem2_v1.json',
    pdfFilename: 'relatorio_canoas_2025_2025_sem2_v1.pdf',
  },
};

// ─── Workbook builder ─────────────────────────────────────────────────────────

/**
 * Creates and returns an in-memory ExcelJS Workbook populated with the Canoas
 * layout. Persist with:
 *   const wb = await buildCanoasWorkbook();
 *   await wb.xlsx.writeFile(filePath);
 *
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function buildCanoasWorkbook() {
  const workbook = new ExcelJS.Workbook();
  _buildProficienciasSheet(workbook);
  _buildHabilidadesSheet(workbook);
  return workbook;
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

function _buildProficienciasSheet(workbook) {
  const sheet = workbook.addWorksheet('Proficiências');

  // Metadata block (rows 2-6, columns C-D)
  sheet.getCell('C2').value = 'Nome da rede';
  sheet.getCell('D2').value = FIXTURE.nomeRede;
  sheet.getCell('C3').value = 'Qtd. de escolas';
  sheet.getCell('D3').value = FIXTURE.qtdEscolas;
  sheet.getCell('C4').value = 'Alunos que iniciaram';
  sheet.getCell('D4').value = FIXTURE.alunosIniciaram;
  sheet.getCell('C5').value = 'Alunos que finalizaram';
  sheet.getCell('D5').value = FIXTURE.alunosFinalizaram;
  sheet.getCell('C6').value = 'Alunos previstos';
  sheet.getCell('D6').value = FIXTURE.alunosPrevistos;

  // Header row (row 15) — isCanoasSchoolHeaderRow() checks for
  // 'Escola', 'Alunos previstos', 'Participação Mat.'
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

  // Data rows (rows 16, 17, 18)
  FIXTURE.schools.forEach((school, idx) => {
    const r = 16 + idx;
    sheet.getCell(`B${r}`).value = 'Feito';
    sheet.getCell(`C${r}`).value = school.nome;
    sheet.getCell(`D${r}`).value = school.iniciaram;
    sheet.getCell(`E${r}`).value = school.finalizaram;
    sheet.getCell(`F${r}`).value = school.previstos;
    sheet.getCell(`G${r}`).value = school.participantesMt;
    sheet.getCell(`H${r}`).value = school.participantesLp;
    sheet.getCell(`I${r}`).value = school.participacaoTotal;
    sheet.getCell(`J${r}`).value = school.proxyMediaMt;
    sheet.getCell(`K${r}`).value = school.proxyMediaLp;
    sheet.getCell(`N${r}`).value = school.mtAbaixo;
    sheet.getCell(`O${r}`).value = school.mtBasico;
    sheet.getCell(`P${r}`).value = school.mtProficiente;
    sheet.getCell(`Q${r}`).value = school.mtAvancado;
    sheet.getCell(`T${r}`).value = school.lpAbaixo;
    sheet.getCell(`U${r}`).value = school.lpBasico;
    sheet.getCell(`V${r}`).value = school.lpProficiente;
    sheet.getCell(`W${r}`).value = school.lpAvancado;
  });
}

function _buildHabilidadesSheet(workbook) {
  const sheet = workbook.addWorksheet('Habilidades');

  // Header row (row 1) — must match CANOAS_HABILIDADES_COLUMN_ALIASES keys
  sheet.addRow([
    'Área de Conhecimento',
    'Ano Escolar',
    'Tag (Código)',
    'Temática',
    'Habilidade',
    'Desempenho (%)',
  ]);

  // Data rows (rows 2-7)
  FIXTURE.habilidades.forEach((h) => {
    sheet.addRow([h.area, h.ano, h.codigo, h.tematica, h.habilidade, h.desempenho]);
  });
}

module.exports = { FIXTURE, EXPECTED, buildCanoasWorkbook };
