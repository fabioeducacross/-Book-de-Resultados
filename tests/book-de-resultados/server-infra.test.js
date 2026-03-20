'use strict';

const { createStorage, generateJobId } = require('../../packages/book-de-resultados/server/storage');
const { createWebhookNotifier, buildWebhookPayload } = require('../../packages/book-de-resultados/server/webhook');
const os = require('os');
const fs = require('fs');
const path = require('path');

describe('storage — local driver', () => {
  const baseDir = path.join(os.tmpdir(), 'book-storage-test');
  let storage;

  beforeAll(() => {
    storage = createStorage({ driver: 'local', localDir: baseDir });
  });

  afterAll(() => {
    if (fs.existsSync(baseDir)) fs.rmSync(baseDir, { recursive: true, force: true });
  });

  test('creates baseDir on init', () => {
    expect(fs.existsSync(baseDir)).toBe(true);
  });

  test('stores a file and returns metadata', async () => {
    // Create a dummy PDF
    const tmpFile = path.join(os.tmpdir(), 'test-book.pdf');
    fs.writeFileSync(tmpFile, 'fake-pdf-content');

    const result = await storage.store('test-job-1', tmpFile);

    expect(result.key).toBe('test-job-1.pdf');
    expect(result.url).toBe('/download/test-job-1');
    expect(result.size).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(baseDir, 'test-job-1.pdf'))).toBe(true);

    fs.unlinkSync(tmpFile);
  });

  test('getFile returns stream and metadata', () => {
    const file = storage.getFile('test-job-1');
    expect(file).not.toBeNull();
    expect(file.filename).toBe('test-job-1.pdf');
    expect(file.size).toBeGreaterThan(0);
    // Consume stream to avoid leak
    file.stream.destroy();
  });

  test('getFile returns null for unknown job', () => {
    const file = storage.getFile('nonexistent');
    expect(file).toBeNull();
  });

  test('cleanup removes stored files', async () => {
    await storage.cleanup('test-job-1');
    expect(storage.getFile('test-job-1')).toBeNull();
  });
});

describe('storage — generateJobId', () => {
  test('generates unique IDs', () => {
    const id1 = generateJobId();
    const id2 = generateJobId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^book-/);
  });
});

describe('webhook — buildWebhookPayload', () => {
  test('builds completion payload', () => {
    const payload = buildWebhookPayload('job-1', 'completed', { downloadUrl: '/dl/1' });
    expect(payload.event).toBe('book.ready');
    expect(payload.jobId).toBe('job-1');
    expect(payload.status).toBe('completed');
    expect(payload.downloadUrl).toBe('/dl/1');
    expect(payload).toHaveProperty('timestamp');
  });

  test('builds failure payload', () => {
    const payload = buildWebhookPayload('job-2', 'failed', { error: 'timeout' });
    expect(payload.event).toBe('book.failed');
    expect(payload.status).toBe('failed');
    expect(payload.error).toBe('timeout');
  });
});

describe('webhook — createWebhookNotifier', () => {
  test('returns not successful when no URL provided', async () => {
    const notifier = createWebhookNotifier({ retryAttempts: 1 });
    const result = await notifier.notify(null, {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No webhook URL/);
  });
});
