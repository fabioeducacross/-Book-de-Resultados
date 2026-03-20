'use strict';

/**
 * Storage Layer — Book de Resultados Service
 *
 * Abstracts PDF storage behind a driver interface.
 * - 'local': filesystem (dev/test)
 * - 's3': AWS S3 / MinIO (production)
 *
 * Each driver implements: store(jobId, filePath) → { url, key }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Creates a storage instance based on config.
 * @param {object} storageConfig - config.storage from config.js
 * @returns {{ store: Function, getUrl: Function }}
 */
function createStorage(storageConfig) {
  const driver = storageConfig.driver || 'local';

  if (driver === 's3') {
    return createS3Storage(storageConfig.s3);
  }

  return createLocalStorage(storageConfig.localDir);
}

// ── Local filesystem driver ──────────────────────────────────────────────────

function createLocalStorage(baseDir) {
  fs.mkdirSync(baseDir, { recursive: true });

  return {
    driver: 'local',

    /**
     * Stores a generated PDF file.
     * @param {string} jobId
     * @param {string} filePath - source PDF path
     * @returns {Promise<{ key: string, url: string, size: number }>}
     */
    async store(jobId, filePath) {
      const ext = path.extname(filePath);
      const key = `${jobId}${ext}`;
      const dest = path.join(baseDir, key);

      fs.copyFileSync(filePath, dest);
      const stat = fs.statSync(dest);

      return {
        key,
        url: `/download/${jobId}`,
        localPath: dest,
        size: stat.size,
      };
    },

    /**
     * Returns a readable stream for the stored file.
     * @param {string} jobId
     * @returns {{ stream: ReadableStream, filename: string } | null}
     */
    getFile(jobId) {
      const candidates = fs.readdirSync(baseDir).filter((f) => f.startsWith(jobId));
      if (candidates.length === 0) return null;

      const filename = candidates[0];
      const filePath = path.join(baseDir, filename);

      return {
        stream: fs.createReadStream(filePath),
        filename,
        size: fs.statSync(filePath).size,
      };
    },

    /**
     * Deletes stored files for a job.
     * @param {string} jobId
     */
    async cleanup(jobId) {
      const candidates = fs.readdirSync(baseDir).filter((f) => f.startsWith(jobId));
      for (const f of candidates) {
        fs.unlinkSync(path.join(baseDir, f));
      }
    },
  };
}

// ── S3 driver (lazy-loaded) ──────────────────────────────────────────────────

function createS3Storage(s3Config) {
  let s3Client = null;

  function getClient() {
    if (s3Client) return s3Client;

    // Lazy-load AWS SDK to avoid requiring it when using local storage
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({ region: s3Config.region });
    return s3Client;
  }

  return {
    driver: 's3',

    async store(jobId, filePath) {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      const { GetObjectCommand } = require('@aws-sdk/client-s3');

      const ext = path.extname(filePath);
      const key = `${s3Config.prefix}${jobId}${ext}`;
      const fileBuffer = fs.readFileSync(filePath);

      const client = getClient();
      await client.send(new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: 'application/pdf',
      }));

      const url = await getSignedUrl(client, new GetObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
      }), { expiresIn: 86400 }); // 24h

      return {
        key,
        url,
        size: fileBuffer.length,
      };
    },

    getFile(jobId) {
      // For S3, download is via presigned URL — not streaming through the server
      return null;
    },

    async cleanup(jobId) {
      const { DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
      const client = getClient();
      const prefix = `${s3Config.prefix}${jobId}`;

      const list = await client.send(new ListObjectsV2Command({
        Bucket: s3Config.bucket,
        Prefix: prefix,
      }));

      if (list.Contents) {
        for (const obj of list.Contents) {
          await client.send(new DeleteObjectCommand({
            Bucket: s3Config.bucket,
            Key: obj.Key,
          }));
        }
      }
    },
  };
}

/**
 * Generates a unique job ID.
 */
function generateJobId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `book-${timestamp}-${random}`;
}

module.exports = { createStorage, generateJobId };
