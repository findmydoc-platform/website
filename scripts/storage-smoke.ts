/**
 * Script: storage-smoke
 * Usage: pnpm dlx tsx scripts/storage-smoke.ts
 * Verifies that Payload writes media bytes to the active storage backend.
 */
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { config as dotenvConfig } from 'dotenv'
import payload from 'payload'
import type { Payload } from 'payload'
import type { BasicUser, PlatformContentMedia } from '../src/payload-types'
import { ensureStorageBucket, waitForStorageObject } from '../src/utilities/storage/s3'
import { getStorageRuntime } from '../src/utilities/storage/runtime'

function createTinyPngFile(name: string) {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
  const data = Buffer.from(base64, 'base64')

  return {
    name,
    data,
    mimetype: 'image/png',
    size: data.length,
  }
}

async function main() {
  process.stderr.write('[storage:smoke] starting\n')
  process.env.PAYLOAD_LOG_LEVEL ||= 'info'

  dotenvConfig({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
  dotenvConfig({ path: path.resolve(process.cwd(), '.env'), quiet: true })

  if (!process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET_KEY) {
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET_KEY
  }

  const runtime = getStorageRuntime({ ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'development' })

  try {
    const { default: config } = await import('../src/payload.config')
    await payload.init({ config })

    if (runtime.s3 && process.env.STORAGE_SMOKE_AUTO_CREATE_BUCKET === 'true') {
      await ensureStorageBucket(runtime.s3)
    }

    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `storage-smoke-${randomUUID()}@example.com`,
        firstName: 'Storage',
        lastName: 'Smoke',
        supabaseUserId: `storage-smoke-${randomUUID()}`,
        userType: 'platform',
      },
      overrideAccess: true,
    })) as BasicUser

    const media = (await payload.create({
      collection: 'platformContentMedia',
      data: {
        alt: 'Storage smoke test asset',
        createdBy: basicUser.id,
      },
      draft: false,
      file: createTinyPngFile(`storage-smoke-${randomUUID()}.png`),
      overrideAccess: true,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

    if (typeof media.filename !== 'string' || media.filename.length === 0) {
      throw new Error('Smoke upload did not return a filename')
    }

    console.log(
      `[storage:smoke] mode=${runtime.mode} mediaId=${String(media.id)} filename=${media.filename} storagePath=${media.storagePath}`,
    )

    if (runtime.s3) {
      const result = await waitForStorageObject(runtime.s3, media.storagePath)
      console.log(
        `[storage:smoke] verified bucket=${runtime.s3.bucket} key=${media.storagePath} size=${result.ContentLength ?? 0}`,
      )
    } else {
      const filePath = path.resolve(process.cwd(), 'public/platform-media', media.filename)
      const stats = await fs.stat(filePath)
      console.log(`[storage:smoke] verified file=${filePath} size=${stats.size}`)
    }

    await payload.delete({
      collection: 'platformContentMedia',
      id: media.id,
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'basicUsers',
      id: basicUser.id,
      overrideAccess: true,
    })

    console.log('[storage:smoke] completed')
  } finally {
    await payload.destroy().catch(() => undefined)
    const exitCode = process.exitCode ?? 0
    setTimeout(() => process.exit(exitCode), 250).unref()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
