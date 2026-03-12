'use strict';

/**
 * Tests for the Exporter module — Book de Resultados
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const mockSlides = [];
const mockWriteFile = jest.fn().mockResolvedValue('ok');

jest.mock('pptxgenjs', () => jest.fn().mockImplementation(() => ({
  layout: '',
  title: '',
  subject: '',
  author: '',
  company: '',
  ChartType: { bar: 'bar' },
  addSlide: jest.fn(() => {
    const slide = {
      addText: jest.fn(),
      addChart: jest.fn(),
      addTable: jest.fn(),
      addShape: jest.fn(),
    };
    mockSlides.push(slide);
    return slide;
  }),
  writeFile: mockWriteFile,
})));

const {
  buildOutputFilename,
  sanitizeFilenameSegment,
  exportPptx,
} = require('../../packages/book-de-resultados/src/exporter');
const {
  buildDistributionChart,
  buildRankingChart,
  buildComparativoChart,
  buildIndicatorCard,
} = require('../../packages/book-de-resultados/src/charts');
const { buildHabilidadesTable } = require('../../packages/book-de-resultados/src/components');

// ─── sanitizeFilenameSegment() ────────────────────────────────────────────────

describe('sanitizeFilenameSegment()', () => {
  test('lowercases the string', () => {
    expect(sanitizeFilenameSegment('Canoas')).toBe('canoas');
  });

  test('removes accents', () => {
    expect(sanitizeFilenameSegment('São Paulo')).toBe('sao_paulo');
    expect(sanitizeFilenameSegment('Übung')).toBe('ubung');
  });

  test('replaces spaces with underscores', () => {
    expect(sanitizeFilenameSegment('hello world')).toBe('hello_world');
  });

  test('replaces special characters with underscores', () => {
    expect(sanitizeFilenameSegment('2025/sem1')).toBe('2025_sem1');
  });

  test('trims leading and trailing underscores', () => {
    expect(sanitizeFilenameSegment('_test_')).toBe('test');
  });

  test('collapses multiple separators into one underscore', () => {
    expect(sanitizeFilenameSegment('hello--world')).toBe('hello_world');
  });
});

// ─── buildOutputFilename() ────────────────────────────────────────────────────

describe('buildOutputFilename()', () => {
  const metadata = { municipio: 'Canoas', ano: '2025', ciclo: '2025-sem2' };

  test('builds correct filename for pptx', () => {
    expect(buildOutputFilename(metadata, 'pptx')).toBe('relatorio_canoas_2025_2025_sem2_v1.pptx');
  });

  test('builds correct filename for json', () => {
    expect(buildOutputFilename(metadata, 'json')).toBe('relatorio_canoas_2025_2025_sem2_v1.json');
  });

  test('uses provided version', () => {
    expect(buildOutputFilename(metadata, 'pptx', 'v3')).toBe('relatorio_canoas_2025_2025_sem2_v3.pptx');
  });

  test('handles municipio with accents', () => {
    const meta = { municipio: 'São Leopoldo', ano: '2025', ciclo: 'sem1' };
    const filename = buildOutputFilename(meta, 'pptx');
    expect(filename).toMatch(/relatorio_sao_leopoldo_2025_sem1_v1\.pptx/);
  });

  test('falls back to defaults when fields are missing', () => {
    const filename = buildOutputFilename({}, 'pptx');
    expect(filename).toBe('relatorio_municipio_ano_ciclo_v1.pptx');
  });
});

describe('exportPptx()', () => {
  beforeEach(() => {
    mockSlides.length = 0;
    mockWriteFile.mockClear();
  });

  test('renders pptx charts and footer chrome for school pages', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-pptx-export-'));
    const metadata = { municipio: 'Canoas', ano: '2025', ciclo: '2025-sem1' };
    const pages = [
      {
        section: 'escola',
        title: 'Escola Alpha',
        pageNumber: 1,
        data: {
          nome_escola: 'Escola Alpha',
          rankingPosition: 1,
          sintese: 'Síntese automática.',
          distribuicao: {
            abaixo_do_basico: 2,
            basico: 5,
            adequado: 10,
            avancado: 6,
            total: 23,
            percentuais: { abaixo_do_basico: 8.7, basico: 21.7, adequado: 43.5, avancado: 26.1 },
          },
          components: {
            proficiencia: {
              bars: [
                { label: 'Abaixo do Básico', alunos: 2, percentual: 8.7, color: '#D32F2F' },
                { label: 'Básico', alunos: 5, percentual: 21.7, color: '#F57C00' },
                { label: 'Adequado', alunos: 10, percentual: 43.5, color: '#388E3C' },
                { label: 'Avançado', alunos: 6, percentual: 26.1, color: '#1565C0' },
              ],
              total: 23,
            },
          },
        },
      },
      {
        section: 'ranking',
        title: 'Ranking de Escolas — Matemática',
        pageNumber: 2,
        data: {
          rows: [
            { posicao: 1, nome_escola: 'Escola Alpha', media: 260, participacao: 92 },
            { posicao: 2, nome_escola: 'Escola Beta', media: 245, participacao: 90 },
          ],
        },
      },
      {
        section: 'escola_disciplinas',
        title: 'Escola Alpha — Participação por Área',
        pageNumber: 3,
        data: {
          nome_escola: 'Escola Alpha',
          rankingPosition: 1,
          sintese: 'Comparativo da escola.',
          participacaoPorDisciplina: [
            { disciplina: 'Matemática', mediaEscola: 260, mediaRede: 250, deltaMedia: 10, participacaoEscola: 92, participacaoRede: 90 },
          ],
          components: {
            comparativo: {
              rows: [
                {
                  disciplina: 'Matemática',
                  escola: { media: 260, participacao: 92 },
                  rede: { media: 250, participacao: 90 },
                  delta: { mediaFormatted: '+10', mediaColor: '#2E7D32', media: 10 },
                },
              ],
            },
          },
        },
      },
    ];
    const chartsPerPage = [
      [
        buildIndicatorCard('Posição Geral', '1º'),
        buildDistributionChart(pages[0].data.distribuicao),
      ],
      [buildRankingChart(pages[1].data.rows)],
      [
        buildIndicatorCard('Posição Geral', '1º'),
        buildComparativoChart(pages[2].data.participacaoPorDisciplina),
      ],
    ];

    try {
      await exportPptx(pages, chartsPerPage, metadata, tempDir, { version: 'v7' });

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringMatching(/relatorio_canoas_2025_2025_sem1_v7\.pptx$/),
        }),
      );
      expect(mockSlides).toHaveLength(3);
      expect(mockSlides[0].addShape).toHaveBeenCalled();
      expect(mockSlides[1].addChart).toHaveBeenCalled();
      expect(mockSlides[2].addChart).toHaveBeenCalled();
      expect(mockSlides[0].addText).toHaveBeenCalledWith(
        expect.stringContaining('Canoas • 2025-sem1 • 2025 • v7'),
        expect.any(Object),
      );
      expect(mockSlides[0].addText).toHaveBeenCalledWith(
        expect.stringContaining('Ranking geral da rede: 1º lugar'),
        expect.any(Object),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('renders the correct habilidades slice and total pagination context in pptx', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-pptx-habilidades-'));
    const metadata = { municipio: 'Canoas', ano: '2025', ciclo: '2025-sem1' };
    const habilidadeRows = Array.from({ length: 25 }, (_, index) => ({
      codigo: `MAT${index + 1}`,
      descricao: `Habilidade ${index + 1}`,
      percentualAcerto: 60 + index,
    }));
    const tabela = buildHabilidadesTable(
      habilidadeRows,
      { title: 'Habilidades — Matemática', columns: ['codigo', 'descricao', 'percentualAcerto'], maxRowsPerPage: 20 },
    );
    const pages = [
      {
        section: 'habilidades_disciplina',
        title: 'Habilidades — Matemática (2/2)',
        pageNumber: 1,
        data: {
          disciplina: 'Matemática',
          pageIndex: 1,
          totalHabilidades: 25,
          rows: tabela.pages[1],
          components: { tabela },
        },
      },
    ];
    const chartsPerPage = [[
      buildIndicatorCard('Total de Habilidades', 25),
      buildIndicatorCard('Área / Disciplina', 'Matemática'),
    ]];

    try {
      await exportPptx(pages, chartsPerPage, metadata, tempDir, { version: 'v7' });

      expect(mockSlides).toHaveLength(1);
      expect(mockSlides[0].addText).toHaveBeenCalledWith(
        expect.stringContaining('2 / 2 páginas  •  25 habilidades no total'),
        expect.any(Object),
      );
      expect(mockSlides[0].addTable).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ text: 'MAT21' }),
            expect.objectContaining({ text: 'Habilidade 21' }),
          ]),
        ]),
        expect.any(Object),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
