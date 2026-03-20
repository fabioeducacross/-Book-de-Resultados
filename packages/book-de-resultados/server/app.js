'use strict';

/**
 * HTTP Server — Book de Resultados Service
 *
 * Fastify-based API that the BackOffice calls to generate PDF books.
 *
 * Endpoints:
 *   POST   /generate       — Enqueue a new book generation job
 *   GET    /status/:jobId  — Check job status
 *   GET    /download/:jobId — Download the generated PDF
 *   GET    /health         — Health check
 *   GET    /stats          — Queue statistics
 *
 * Flow:
 *   BackOffice POST /generate { data, webhookUrl }
 *     → 202 { jobId }
 *     → worker generates PDF async
 *     → webhook POST to BackOffice: { event: "book.ready", downloadUrl }
 *     → BackOffice GET /download/:jobId
 */

const { loadConfig } = require('./config');
const { createStorage } = require('./storage');
const { createWebhookNotifier } = require('./webhook');
const { createJobQueue } = require('./job-queue');
const { validatePayloadShape } = require('../src/input-adapter');

/**
 * Builds and returns the Fastify app instance (does not start listening).
 * @param {object} [overrides] - optional config overrides for testing
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
async function buildApp(overrides = {}) {
    const Fastify = require('fastify');
    const config = { ...loadConfig(), ...overrides };

    const app = Fastify({
        logger: {
            level: config.logLevel,
        },
        bodyLimit: 10 * 1024 * 1024, // 10MB max payload
    });

    // ── Dependencies ───────────────────────────────────────────────────────────
    const storage = createStorage(config.storage);
    const webhookNotifier = createWebhookNotifier(config.webhook, app.log);

    // Lazy-load pipeline to keep server module testable
    const { generateBook } = require('../src/index');
    const queue = createJobQueue(generateBook, storage, webhookNotifier, config, app.log);

    // Decorate for route handlers
    app.decorate('bookQueue', queue);
    app.decorate('bookStorage', storage);
    app.decorate('bookConfig', config);

    app.addHook('onRequest', async (request, reply) => {
        const origin = request.headers.origin || '*';
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Vary', 'Origin');
        reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    });

    app.options('/*', async (request, reply) => reply.status(204).send());

    // ── Routes ─────────────────────────────────────────────────────────────────

    // Health check
    app.get('/health', async () => ({
        status: 'ok',
        service: 'book-de-resultados',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    }));

    // Queue statistics
    app.get('/stats', async () => ({
        queue: queue.stats(),
        storage: { driver: storage.driver },
        timestamp: new Date().toISOString(),
    }));

    // Enqueue book generation
    app.post('/generate', {
        schema: {
            body: {
                type: 'object',
                required: ['data'],
                properties: {
                    data: { type: 'object', description: 'Book data payload (canonical contract)' },
                    webhookUrl: { type: 'string', format: 'uri', description: 'Callback URL for completion notification' },
                    version: { type: 'string', default: 'v1', description: 'Version label for the output file' },
                    config: {
                        type: 'object',
                        properties: {
                            theme: { type: 'object', description: 'Theme overrides' },
                            logoUrl: { type: 'string' },
                            imagemInstitucional: { type: 'string' },
                        },
                        additionalProperties: false,
                    },
                },
                additionalProperties: false,
            },
            response: {
                202: {
                    type: 'object',
                    properties: {
                        jobId: { type: 'string' },
                        status: { type: 'string' },
                        statusUrl: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        details: { type: 'array', items: { type: 'string' } },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { data, webhookUrl, version } = request.body;

        // Validate payload shape before enqueuing
        const shapeCheck = validatePayloadShape(data);
        if (!shapeCheck.valid) {
            return reply.status(400).send({
                error: 'Payload de dados inválido',
                details: shapeCheck.errors,
            });
        }

        const jobId = queue.enqueue({
            payload: data,
            webhookUrl,
            version: version || 'v1',
        });

        app.log.info(`Job ${jobId} enqueued for ${data.metadata?.municipio || 'unknown'}`);

        return reply.status(202).send({
            jobId,
            status: 'queued',
            statusUrl: `/status/${jobId}`,
            message: 'Geração do book iniciada. Use statusUrl para acompanhar o progresso.',
        });
    });

    // Job status
    app.get('/status/:jobId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    jobId: { type: 'string' },
                },
                required: ['jobId'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        jobId: { type: 'string' },
                        status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed'] },
                        createdAt: { type: 'string' },
                        startedAt: { type: ['string', 'null'] },
                        completedAt: { type: ['string', 'null'] },
                        result: {
                            type: ['object', 'null'],
                            properties: {
                                downloadUrl: { type: 'string' },
                                pageCount: { type: 'integer' },
                                fileSize: { type: 'integer' },
                                durationMs: { type: 'integer' },
                                filename: { type: 'string' },
                            },
                        },
                        error: { type: ['string', 'null'] },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { jobId } = request.params;
        const status = queue.getStatus(jobId);

        if (!status) {
            return reply.status(404).send({ error: `Job "${jobId}" não encontrado` });
        }

        return status;
    });

    // Download PDF
    app.get('/download/:jobId', async (request, reply) => {
        const { jobId } = request.params;
        const status = queue.getStatus(jobId);

        if (!status) {
            return reply.status(404).send({ error: `Job "${jobId}" não encontrado` });
        }

        if (status.status !== 'completed') {
            return reply.status(409).send({
                error: 'PDF ainda não está pronto',
                status: status.status,
                statusUrl: `/status/${jobId}`,
            });
        }

        // If S3, redirect to presigned URL
        if (storage.driver === 's3' && status.result?.downloadUrl) {
            return reply.redirect(302, status.result.downloadUrl);
        }

        // Local storage: stream the file
        const file = storage.getFile(jobId);
        if (!file) {
            return reply.status(410).send({ error: 'Arquivo não encontrado no storage' });
        }

        return reply
            .header('Content-Type', 'application/pdf')
            .header('Content-Disposition', `attachment; filename="${file.filename}"`)
            .header('Content-Length', file.size)
            .send(file.stream);
    });

    return app;
}

module.exports = { buildApp };
