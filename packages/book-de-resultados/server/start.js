'use strict';

/**
 * Server Entry Point — Book de Resultados Service
 *
 * Starts the HTTP server.
 *
 * Usage:
 *   node server/start.js
 *
 * Environment variables:
 *   BOOK_PORT                       - HTTP port (default: 3100)
 *   BOOK_HOST                       - Bind address (default: 0.0.0.0)
 *   BOOK_STORAGE_DRIVER             - 'local' or 's3' (default: local)
 *   BOOK_STORAGE_DIR                - Local storage directory
 *   BOOK_DE_RESULTADOS_PDF_BROWSER  - Path to Chrome/Chromium
 *   BOOK_LOG_LEVEL                  - Log level (default: info)
 *   BOOK_JOB_CONCURRENCY            - Parallel job limit (default: 2)
 *   REDIS_URL                       - Redis URL (optional, for BullMQ)
 */

const { buildApp } = require('./app');
const { loadConfig } = require('./config');

async function main() {
  const config = loadConfig();
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Book de Resultados service listening on ${config.host}:${config.port}`);
    app.log.info(`Storage driver: ${config.storage.driver}`);
    app.log.info(`Job concurrency: ${config.concurrency}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      await app.close();
      process.exit(0);
    });
  }
}

main();
