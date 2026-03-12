'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadAuditStore,
  persistAuditStore,
  buildSummary,
  buildPagedRunsResponse,
  listRuns,
} = require('../../packages/book-de-resultados/examples/upload-listagem-auditoria-server');

describe('upload-listagem-auditoria-server', () => {
  let tempDir;
  let storeFile;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ui-server-test-'));
    storeFile = path.join(tempDir, 'audit-runs.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('loadAuditStore seeds and persists the default runs when file does not exist', () => {
    const store = loadAuditStore(storeFile);

    expect(store.runs).toHaveLength(4);
    expect(store.nextId).toBe(5);
    expect(fs.existsSync(storeFile)).toBe(true);
  });

  test('persistAuditStore writes added runs and loadAuditStore restores them', () => {
    const store = loadAuditStore(storeFile);

    store.runs.unshift({
      id: 'run_99',
      fileName: 'novo_arquivo.xlsx',
      fileType: 'XLSX',
      operation: 'Importação do Book',
      status: 'Sucesso',
      owner: 'Equipe QA',
      uploadedAt: '2025-07-11T10:00:00.000Z',
      uploadedAtLabel: '11/07/2025, 07:00',
      outputFile: '/exports/novo_arquivo.json',
      durationMs: 500,
      durationLabel: '0.5 s',
      recordCount: 10,
      validCount: 10,
      errorCount: 0,
      warningCount: 0,
      timeline: [],
      logLines: [],
      kpis: [],
      detailStatus: 'success',
    });
    store.nextId = 100;

    persistAuditStore(store);

    const restoredStore = loadAuditStore(storeFile);

    expect(restoredStore.nextId).toBe(100);
    expect(restoredStore.runs[0].id).toBe('run_99');
  });

  test('listRuns applies combined filters for operation, status, owner, date and record', () => {
    const store = loadAuditStore(storeFile);

    const items = listRuns(store, {
      operation: 'Importação do Book',
      status: 'Sucesso',
      owner: 'ana',
      date: '01/07/2025',
      record: 'municipio',
    });

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('run_4');
  });

  test('buildSummary returns counters for a filtered run set', () => {
    const store = loadAuditStore(storeFile);
    const items = listRuns(store, { status: 'Parcial' });

    expect(buildSummary(items)).toEqual({
      totalLogs: 1,
      successCount: 0,
      partialCount: 1,
      errorCount: 0,
      latestRunId: 'run_2',
    });
  });

  test('buildPagedRunsResponse paginates filtered results and returns navigation metadata', () => {
    const store = loadAuditStore(storeFile);
    const items = listRuns(store, { operation: 'Importação do Book' });

    const response = buildPagedRunsResponse(items, { page: 2, pageSize: 1 });

    expect(response.items).toHaveLength(1);
    expect(response.items[0].id).toBe('run_4');
    expect(response.pagination).toEqual({
      page: 2,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
      startIndex: 2,
      endIndex: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });
});