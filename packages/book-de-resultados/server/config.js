'use strict';

/**
 * Server Configuration — Book de Resultados Service
 *
 * Loads configuration from environment variables with sensible defaults.
 * All config is centralized here — no env reads scattered in other modules.
 */

function loadConfig() {
  return {
    // Server
    port: parseInt(process.env.BOOK_PORT || '3100', 10),
    host: process.env.BOOK_HOST || '0.0.0.0',

    // Job processing
    concurrency: parseInt(process.env.BOOK_JOB_CONCURRENCY || '2', 10),
    jobTimeoutMs: parseInt(process.env.BOOK_JOB_TIMEOUT_MS || '120000', 10),

    // Redis (optional — falls back to in-memory queue)
    redis: process.env.REDIS_URL || null,

    // Storage
    storage: {
      driver: process.env.BOOK_STORAGE_DRIVER || 'local', // 'local' | 's3'
      localDir: process.env.BOOK_STORAGE_DIR || '/tmp/book-output',
      s3: {
        bucket: process.env.BOOK_S3_BUCKET || '',
        region: process.env.BOOK_S3_REGION || 'us-east-1',
        prefix: process.env.BOOK_S3_PREFIX || 'books/',
      },
    },

    // PDF browser
    pdfBrowserPath: process.env.BOOK_DE_RESULTADOS_PDF_BROWSER || null,

    // Webhook
    webhook: {
      retryAttempts: parseInt(process.env.BOOK_WEBHOOK_RETRIES || '3', 10),
      retryDelayMs: parseInt(process.env.BOOK_WEBHOOK_RETRY_DELAY_MS || '2000', 10),
      timeoutMs: parseInt(process.env.BOOK_WEBHOOK_TIMEOUT_MS || '10000', 10),
    },

    // Logging
    logLevel: process.env.BOOK_LOG_LEVEL || 'info',
  };
}

module.exports = { loadConfig };
