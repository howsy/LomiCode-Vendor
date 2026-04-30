// Storage adapter for release artifacts (.exe + .yml).
//
// Two backends, picked at runtime:
//  - S3-compatible (MinIO, real S3, R2, etc.) — when S3_ENDPOINT is set
//  - Local disk (RELEASE_STORAGE_DIR or ./release-storage) — fallback
//
// API is the same in both cases; route handlers don't care which one is active.

import { promises as fs, createReadStream, type ReadStream } from 'fs'
import path from 'path'
import { Readable } from 'stream'

const useS3 = !!process.env.S3_ENDPOINT
const localRoot = path.resolve(process.cwd(), process.env.RELEASE_STORAGE_DIR ?? 'release-storage')

// ─── Lazily-loaded S3 client (only when useS3 is true) ─────────────────
let s3Promise: Promise<any> | null = null
async function s3() {
  if (!s3Promise) {
    s3Promise = (async () => {
      const { S3Client } = await import('@aws-sdk/client-s3')
      return new S3Client({
        region: process.env.S3_REGION ?? 'us-east-1',
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY!,
          secretAccessKey: process.env.S3_SECRET_KEY!,
        },
      })
    })()
  }
  return s3Promise
}
const BUCKET = process.env.S3_BUCKET ?? 'releases'

// ─── Public API ────────────────────────────────────────────────────────

export async function putObject(key: string, body: Buffer | Uint8Array, contentType?: string) {
  if (useS3) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await s3()
    await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
    return key
  }
  const full = path.join(localRoot, key)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, body)
  return key
}

export async function getObjectStream(key: string): Promise<{ body: Readable | ReadStream; contentType?: string; contentLength?: number }> {
  if (useS3) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await s3()
    const r = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    return { body: r.Body as Readable, contentType: r.ContentType, contentLength: r.ContentLength }
  }
  const full = path.join(localRoot, key)
  const stat = await fs.stat(full)
  return {
    body: createReadStream(full),
    contentType: guessType(key),
    contentLength: stat.size,
  }
}

export async function presignDownload(key: string, expiresInSec = 300) {
  if (useS3) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    const client = await s3()
    return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiresInSec })
  }
  // Local mode: just return the API path; auth lives on the route.
  return `/api/v1/updates/download/${key.split('/').map(encodeURIComponent).join('/')}`
}

function guessType(key: string) {
  const k = key.toLowerCase()
  if (k.endsWith('.yml') || k.endsWith('.yaml')) return 'text/yaml'
  if (k.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable'
  if (k.endsWith('.dmg')) return 'application/x-apple-diskimage'
  if (k.endsWith('.appimage')) return 'application/octet-stream'
  return 'application/octet-stream'
}
