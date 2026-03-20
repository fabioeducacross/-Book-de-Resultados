'use strict';

/**
 * Webhook Notifier — Book de Resultados Service
 *
 * Sends callback notifications to the BackOffice when a book
 * generation job completes or fails.
 *
 * Features:
 * - Configurable retry with exponential backoff
 * - Timeout per request
 * - Structured payload with job status + download URL
 */

/**
 * Creates a webhook notifier instance.
 * @param {object} webhookConfig - config.webhook from config.js
 * @param {object} [logger] - optional logger (defaults to console)
 * @returns {{ notify: Function }}
 */
function createWebhookNotifier(webhookConfig, logger) {
  const log = logger || console;
  const { retryAttempts = 3, retryDelayMs = 2000, timeoutMs = 10000 } = webhookConfig;

  return {
    /**
     * Sends a webhook notification.
     * @param {string} webhookUrl - URL to POST to
     * @param {object} payload - notification payload
     * @returns {Promise<{ success: boolean, attempts: number, statusCode?: number, error?: string }>}
     */
    async notify(webhookUrl, payload) {
      if (!webhookUrl) {
        return { success: false, attempts: 0, error: 'No webhook URL provided' };
      }

      for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (response.ok) {
            log.info(`Webhook delivered to ${webhookUrl} (attempt ${attempt})`);
            return { success: true, attempts: attempt, statusCode: response.status };
          }

          log.warn(
            `Webhook attempt ${attempt}/${retryAttempts} to ${webhookUrl} returned ${response.status}`,
          );
        } catch (err) {
          log.warn(
            `Webhook attempt ${attempt}/${retryAttempts} to ${webhookUrl} failed: ${err.message}`,
          );
        }

        if (attempt < retryAttempts) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      log.error(`Webhook delivery to ${webhookUrl} failed after ${retryAttempts} attempts`);
      return { success: false, attempts: retryAttempts, error: `Failed after ${retryAttempts} attempts` };
    },
  };
}

/**
 * Builds the standard webhook payload for job completion.
 */
function buildWebhookPayload(jobId, status, details = {}) {
  return {
    event: status === 'completed' ? 'book.ready' : 'book.failed',
    jobId,
    status,
    timestamp: new Date().toISOString(),
    ...details,
  };
}

module.exports = { createWebhookNotifier, buildWebhookPayload };
