import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'
import { upsertByStableId } from '@/endpoints/seed/utils/upsert'
import { prepareUploadFilenameFromFilePathSync } from '@/hooks/media/prepareUploadFilename'

function platformSeedStoragePathFor(filePath: string): string {
  const baseFilename = prepareUploadFilenameFromFilePathSync(filePath) ?? path.basename(filePath).replace(/[\\/]/g, '_')
  const size = fs.statSync(filePath).size
  const hashInput = `platform:${baseFilename}${size ? `:${size}` : ''}`
  const hash = createHash('sha1').update(hashInput).digest('hex').slice(0, 10)

  return `platform/${hash}-${baseFilename}`
}

describe('upsertByStableId S3 NoSuchKey recovery', () => {
  const find = vi.fn()
  const create = vi.fn()
  const update = vi.fn()
  const updateOne = vi.fn().mockResolvedValue(undefined)
  const warn = vi.fn()

  const payload = {
    find,
    create,
    update,
    db: {
      updateOne,
    },
    logger: { warn },
  } as unknown as Payload

  beforeEach(() => {
    find.mockReset()
    create.mockReset()
    update.mockReset()
    updateOne.mockReset().mockResolvedValue(undefined)
    warn.mockReset()
    vi.stubEnv('S3_BUCKET', 'portalfiles')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('replaces the document and re-creates the upload when the previous object key is missing', async () => {
    find.mockResolvedValue({ totalDocs: 1, docs: [{ id: 'media-1' }] })
    update
      .mockRejectedValueOnce({
        name: 'NoSuchKey',
        Code: 'NoSuchKey',
        Resource: 'portalfiles/platform/rehab-physio.jpg',
        message: 'Object not found',
      })
      .mockResolvedValueOnce({ id: 'media-1' })

    const result = await upsertByStableId(
      payload,
      'platformContentMedia',
      {
        stableId: '3552a36c-29ab-4d0c-b859-01de09d9c360',
        alt: 'Rehab image',
      },
      { filePath: '/tmp/rehab-physio.jpg' },
    )

    expect(result).toEqual({ created: false, updated: true })
    expect(update).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    expect(updateOne).toHaveBeenCalledTimes(1)
    expect(updateOne).toHaveBeenCalledWith({
      collection: 'platformContentMedia',
      id: 'media-1',
      req: {
        context: {
          disableRevalidate: true,
          disableSearchSync: true,
          seedMediaExpectedNoSuchKeyRecovery: true,
        },
      },
      data: {
        stableId: expect.any(String),
        deletedAt: expect.any(Date),
        filename: null,
      },
    })
    expect(warn).toHaveBeenCalledWith(
      'Seed media replacement fallback for missing object key: platform/rehab-physio.jpg',
    )

    const createCall = create.mock.calls[0]?.[0] as Record<string, unknown>

    expect(createCall.filePath).toBe('/tmp/rehab-physio.jpg')
    expect(createCall.data).toEqual({
      stableId: expect.any(String),
      alt: 'Rehab image',
    })
  })

  it('retries a transient upload transport failure before succeeding', async () => {
    let updateCalls = 0
    const payload = {
      find: vi.fn().mockResolvedValue({ totalDocs: 1, docs: [{ id: 'media-2' }] }),
      create: vi.fn(),
      update: async () => {
        updateCalls += 1
        if (updateCalls === 1) {
          throw new Error('ssl/tls alert bad record mac')
        }

        return { id: 'media-2' }
      },
      db: {
        updateOne: vi.fn().mockResolvedValue(undefined),
      },
      logger: { warn },
    } as unknown as Payload

    const result = await upsertByStableId(
      payload,
      'platformContentMedia',
      {
        stableId: '8f2ecf77-5fbe-4f0d-9d3f-4f056e8f3d13',
        alt: 'Retry image',
      },
      { filePath: '/tmp/retry-image.jpg' },
    )

    expect(result).toEqual({ created: false, updated: true })
    expect(updateCalls).toBe(2)
  })

  it('clears same-target platform upload filenames before updating seed media', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-media-'))
    const filePath = path.join(tempDir, 'landing-image.webp')
    fs.writeFileSync(filePath, 'seed-image')

    try {
      find.mockResolvedValue({
        totalDocs: 1,
        docs: [
          {
            id: 'media-3',
            filename: 'stale-landing-image.webp',
            sizes: {
              thumbnail: { filename: 'stale-landing-image-300x200.webp' },
            },
            storagePath: platformSeedStoragePathFor(filePath),
          },
        ],
      })
      update.mockResolvedValue({ id: 'media-3' })

      const result = await upsertByStableId(
        payload,
        'platformContentMedia',
        {
          stableId: '8c419e7c-8475-49c4-b07f-e8a8f3b92d56',
          alt: 'Landing image',
        },
        { filePath },
      )

      expect(result).toEqual({ created: false, updated: true })
      expect(update).toHaveBeenCalledTimes(2)
      expect(update).toHaveBeenNthCalledWith(1, {
        collection: 'platformContentMedia',
        id: 'media-3',
        overrideAccess: true,
        context: {
          disableRevalidate: true,
          disableSearchSync: true,
          seedMediaExpectedNoSuchKeyRecovery: true,
          skipCloudStorage: true,
        },
        req: {
          context: {
            disableRevalidate: true,
            disableSearchSync: true,
            seedMediaExpectedNoSuchKeyRecovery: true,
          },
        },
        data: {
          filename: null,
          sizes: expect.objectContaining({
            medium: { filename: null },
            thumbnail: { filename: null },
          }),
        },
      })
      expect(create).not.toHaveBeenCalled()
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('retries create after clearing trashed upload filenames when filename is blocked by unique index', async () => {
    find
      .mockResolvedValueOnce({ totalDocs: 0, docs: [] })
      .mockResolvedValueOnce({ totalDocs: 1, docs: [{ id: 'trash-1' }] })
      .mockResolvedValueOnce({ totalDocs: 0, docs: [] })

    create
      .mockRejectedValueOnce({
        data: {
          errors: [{ path: 'filename', message: 'Value must be unique' }],
        },
      })
      .mockResolvedValueOnce({ id: 'media-new' })

    const result = await upsertByStableId(
      payload,
      'platformContentMedia',
      {
        stableId: 'd91b7a10-7e2f-4f61-af76-fca85f0e4195',
        alt: 'Recovery image',
      },
      { filePath: '/tmp/recovery-image.jpg' },
    )

    expect(result).toEqual({ created: true, updated: false })
    expect(create).toHaveBeenCalledTimes(2)
    expect(updateOne).toHaveBeenCalledWith({
      collection: 'platformContentMedia',
      id: 'trash-1',
      req: {
        context: {
          disableRevalidate: true,
          disableSearchSync: true,
          seedMediaExpectedNoSuchKeyRecovery: true,
        },
      },
      data: {
        filename: null,
      },
    })
    expect(warn).toHaveBeenCalledWith(
      'Seed upload filename conflict recovery: cleared filename on 1 trashed platformContentMedia doc(s) before retry',
    )
  })
})
