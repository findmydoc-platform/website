import { CreateBucketCommand, HeadBucketCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { S3RuntimeConfig } from './runtime'

export function createStorageS3Client(config: S3RuntimeConfig): S3Client {
  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    region: config.region,
  })
}

export async function ensureStorageBucket(config: S3RuntimeConfig): Promise<void> {
  const client = createStorageS3Client(config)

  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = typeof error === 'object' && error !== null ? String((error as { name?: unknown }).name ?? '') : ''
    const bucketMissing =
      code === 'NotFound' || code === 'NoSuchBucket' || /NotFound|NoSuchBucket|UnknownError/i.test(message)

    if (!bucketMissing) throw error

    await client.send(new CreateBucketCommand({ Bucket: config.bucket }))
  }
}

export async function headStorageObject(config: S3RuntimeConfig, key: string) {
  const client = createStorageS3Client(config)
  return client.send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  )
}

function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { name?: unknown; Code?: unknown; message?: unknown }
  const name = typeof candidate.name === 'string' ? candidate.name : ''
  const code = typeof candidate.Code === 'string' ? candidate.Code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  return name === 'NotFound' || code === 'NotFound' || /NotFound|NoSuchKey|Unknown/i.test(message)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForStorageObject(
  config: S3RuntimeConfig,
  key: string,
  options?: { intervalMs?: number; timeoutMs?: number },
) {
  const timeoutMs = options?.timeoutMs ?? 5000
  const intervalMs = options?.intervalMs ?? 250
  const start = Date.now()

  while (true) {
    try {
      return await headStorageObject(config, key)
    } catch (error) {
      if (!isMissingObjectError(error)) throw error
      if (Date.now() - start > timeoutMs) throw error
      await sleep(intervalMs)
    }
  }
}
