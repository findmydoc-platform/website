import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { upsertByStableId } from '@/endpoints/seed/utils/upsert'

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
      req: { context: { disableRevalidate: true, disableSearchSync: true } },
      data: {
        stableId: expect.any(String),
        deletedAt: expect.any(Date),
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
})
