'use strict';

/**
 * Job Queue — Book de Resultados Service
 *
 * Manages async PDF generation jobs.
 * Two implementations:
 *   - In-memory queue (dev/test — no Redis required)
 *   - BullMQ queue (production — requires Redis)
 *
 * Both expose the same interface: enqueue(), getStatus(), onCompleted()
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { generateJobId } = require('./storage');

// ── In-Memory Job Queue ──────────────────────────────────────────────────────

function createMemoryQueue(pipeline, storage, webhookNotifier, config, logger) {
  const log = logger || console;
  const jobs = new Map();
  const listeners = { completed: [], failed: [] };
  let activeCount = 0;
  const pendingQueue = [];
  const maxConcurrency = config.concurrency || 2;

  function emit(event, data) {
    for (const fn of listeners[event] || []) {
      try { fn(data); } catch (e) { log.error(`Listener error: ${e.message}`); }
    }
  }

  async function processJob(jobId) {
    const job = jobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    activeCount++;

    try {
      const outputDir = path.join(os.tmpdir(), `book-job-${jobId}`);
      fs.mkdirSync(outputDir, { recursive: true });

      const result = await pipeline({
        inputData: job.payload,
        outputDir,
        format: 'pdf',
        version: job.version || 'v1',
        pdfBrowserPath: config.pdfBrowserPath,
        keepHtml: false,
      });

      const stored = await storage.store(jobId, result.outputFile);

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = {
        downloadUrl: stored.url,
        storageKey: stored.key,
        fileSize: stored.size,
        pageCount: result.pageCount,
        durationMs: result.durationMs,
        filename: result.filename,
      };

      // Cleanup temp directory
      fs.rmSync(outputDir, { recursive: true, force: true });

      // Webhook notification
      if (job.webhookUrl) {
        const { buildWebhookPayload } = require('./webhook');
        const whPayload = buildWebhookPayload(jobId, 'completed', {
          downloadUrl: stored.url,
          pageCount: result.pageCount,
          filename: result.filename,
        });
        webhookNotifier.notify(job.webhookUrl, whPayload).catch((err) => {
          log.error(`Webhook error for job ${jobId}: ${err.message}`);
        });
      }

      log.info(`Job ${jobId} completed: ${result.pageCount} pages, ${result.durationMs}ms`);
      emit('completed', { jobId, result: job.result });
    } catch (err) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = err.message;

      if (job.webhookUrl) {
        const { buildWebhookPayload } = require('./webhook');
        const whPayload = buildWebhookPayload(jobId, 'failed', { error: err.message });
        webhookNotifier.notify(job.webhookUrl, whPayload).catch((whErr) => {
          log.error(`Webhook error for job ${jobId}: ${whErr.message}`);
        });
      }

      log.error(`Job ${jobId} failed: ${err.message}`);
      emit('failed', { jobId, error: err.message });
    } finally {
      activeCount--;
      drainPending();
    }
  }

  function drainPending() {
    while (activeCount < maxConcurrency && pendingQueue.length > 0) {
      const nextJobId = pendingQueue.shift();
      processJob(nextJobId);
    }
  }

  return {
    /**
     * Enqueues a new book generation job.
     * @param {object} params
     * @param {object} params.payload - JSON data for generateBook
     * @param {string} [params.webhookUrl] - callback URL
     * @param {string} [params.version] - version string
     * @returns {string} jobId
     */
    enqueue({ payload, webhookUrl, version }) {
      const jobId = generateJobId();

      jobs.set(jobId, {
        jobId,
        status: 'queued',
        payload,
        webhookUrl: webhookUrl || null,
        version: version || 'v1',
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        result: null,
        error: null,
      });

      if (activeCount < maxConcurrency) {
        processJob(jobId);
      } else {
        pendingQueue.push(jobId);
      }

      return jobId;
    },

    /**
     * Returns the current status of a job.
     * @param {string} jobId
     * @returns {object|null}
     */
    getStatus(jobId) {
      const job = jobs.get(jobId);
      if (!job) return null;

      return {
        jobId: job.jobId,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        result: job.result,
        error: job.error,
      };
    },

    /**
     * Returns queue statistics.
     */
    stats() {
      let queued = 0;
      let processing = 0;
      let completed = 0;
      let failed = 0;

      for (const job of jobs.values()) {
        switch (job.status) {
          case 'queued': queued++; break;
          case 'processing': processing++; break;
          case 'completed': completed++; break;
          case 'failed': failed++; break;
        }
      }

      return { queued, processing, completed, failed, total: jobs.size };
    },

    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
  };
}

/**
 * Creates the appropriate job queue based on config.
 * Falls back to in-memory if Redis is not configured.
 */
function createJobQueue(pipeline, storage, webhookNotifier, config, logger) {
  // For now, always use in-memory queue.
  // BullMQ integration can be added when Redis infra is ready.
  return createMemoryQueue(pipeline, storage, webhookNotifier, config, logger);
}

module.exports = { createJobQueue };
