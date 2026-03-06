'use strict';

/**
 * Tests for the Renderer module — Book de Resultados
 */

const { render } = require('../../packages/book-de-resultados/src/renderer');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMetrics(overrides = {}) {
  return {
    metadata: { municipio: 'Canoas', ano: 2025, ciclo: '2025-sem1', data: '2025-06-01' },
    rede: {
      totalEscolas: 2,
      totalAlunos: 73,
      participacaoMedia: 89.0,
      mediaGeral: 246.3,
      distribuicao: {
        abaixo_do_basico: 7,
        basico: 17,
        adequado: 35,
        avancado: 13,
        total: 72,
        percentuais: { abaixo_do_basico: 9.7, basico: 23.6, adequado: 48.6, avancado: 18.1 },
      },
      mediasPorDisciplina: {
        Matemática: { media: 250, participacao: 90 },
        Português: { media: 242.5, participacao: 88 },
      },
    },
    escolas: [
      {
        id_escola: '1',
        nome_escola: 'Escola Alpha',
        media: 257.5,
        participacao: 91.5,
        totalAlunos: 37,
        distribuicao: {
          abaixo_do_basico: 2,
          basico: 5,
          adequado: 20,
          avancado: 10,
          total: 37,
          percentuais: { abaixo_do_basico: 5.4, basico: 13.5, adequado: 54.1, avancado: 27 },
        },
        resultadosPorAno: [
          { ano: '5', disciplina: 'Matemática', media: 260, participacao: 92 },
          { ano: '5', disciplina: 'Português', media: 255, participacao: 91 },
        ],
      },
    ],
    rankings: {
      Matemática: [
        { id_escola: '1', nome_escola: 'Escola Alpha', media: 260, participacao: 92, posicao: 1 },
        { id_escola: '2', nome_escola: 'Escola Beta', media: 240, participacao: 88, posicao: 2 },
      ],
    },
    paginatedRankings: {
      Matemática: [
        [
          { id_escola: '1', nome_escola: 'Escola Alpha', media: 260, participacao: 92, posicao: 1 },
          { id_escola: '2', nome_escola: 'Escola Beta', media: 240, participacao: 88, posicao: 2 },
        ],
      ],
    },
    disciplinas: ['Matemática', 'Português'],
    anos: ['5'],
    totalEscolas: 2,
    ...overrides,
  };
}

// ─── render() ─────────────────────────────────────────────────────────────────

describe('render()', () => {
  let pages;

  beforeEach(() => {
    pages = render(makeMetrics());
  });

  test('returns an array of page objects', () => {
    expect(Array.isArray(pages)).toBe(true);
    expect(pages.length).toBeGreaterThan(0);
  });

  test('assigns sequential page numbers starting from 1', () => {
    pages.forEach((page, idx) => {
      expect(page.pageNumber).toBe(idx + 1);
    });
  });

  test('first page is the capa', () => {
    expect(pages[0].section).toBe('capa');
  });

  test('contains a sumario page', () => {
    const sumario = pages.find((p) => p.section === 'sumario');
    expect(sumario).toBeDefined();
  });

  test('sumario entries have page numbers and titles', () => {
    const sumario = pages.find((p) => p.section === 'sumario');
    expect(sumario.data.entries.length).toBeGreaterThan(0);
    sumario.data.entries.forEach((entry) => {
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('page');
      expect(typeof entry.page).toBe('number');
    });
  });

  test('contains visao_geral page', () => {
    const pg = pages.find((p) => p.section === 'visao_geral');
    expect(pg).toBeDefined();
    expect(pg.data.totalEscolas).toBe(2);
  });

  test('generates one resultados_disciplina page per discipline', () => {
    const disciplinaPages = pages.filter((p) => p.section === 'resultados_disciplina');
    expect(disciplinaPages.length).toBe(2); // Matemática + Português
  });

  test('generates ranking pages', () => {
    const rankingPages = pages.filter((p) => p.section === 'ranking');
    expect(rankingPages.length).toBeGreaterThan(0);
  });

  test('generates one escola page per escola', () => {
    const escolaPages = pages.filter((p) => p.section === 'escola');
    expect(escolaPages).toHaveLength(1);
    expect(escolaPages[0].data.nome_escola).toBe('Escola Alpha');
  });

  test('generates resultados_ano pages', () => {
    const anoPages = pages.filter((p) => p.section === 'resultados_ano');
    expect(anoPages).toHaveLength(1); // ano '5'
  });

  test('last page before end is metodologia', () => {
    const metodologia = pages.find((p) => p.section === 'metodologia');
    expect(metodologia).toBeDefined();
  });

  test('capa page has municipio and ano from metadata', () => {
    const capa = pages.find((p) => p.section === 'capa');
    expect(capa.data.municipio).toBe('Canoas');
    expect(capa.data.ano).toBe(2025);
  });

  test('escola page carries mediaRede', () => {
    const escolaPage = pages.find((p) => p.section === 'escola');
    expect(escolaPage.data.mediaRede).toBe(246.3);
  });
});

// ─── render() — with multiple paginated rankings ──────────────────────────────

describe('render() — paginated rankings', () => {
  test('generates multiple ranking pages when paginatedRankings has multiple pages', () => {
    const rows25 = Array.from({ length: 25 }, (_, i) => ({
      id_escola: String(i + 1),
      nome_escola: `Escola ${i + 1}`,
      media: 300 - i,
      participacao: 90,
      posicao: i + 1,
    }));

    const metrics = makeMetrics({
      paginatedRankings: { Matemática: [rows25, rows25.slice(0, 5)] },
    });

    const pages = render(metrics);
    const rankingPages = pages.filter((p) => p.section === 'ranking');
    expect(rankingPages.length).toBe(2);
  });
});
