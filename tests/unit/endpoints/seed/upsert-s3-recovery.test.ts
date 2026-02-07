import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { upsertByStableId } from '@/endpoints/seed/utils/upsert'

describe('upsertByStableId S3 NoSuchKey recovery', () => {
  const find = vi.fn()
  const create = vi.fn()
  const update = vi.fn()
  const warn = vi.fn()

  const payload = {
    find,
    create,
    update,
    logger: { warn },
  } as unknown as Payload

  beforeEach(() => {
    vi.stubEnv('S3_BUCKET', 'portalfiles')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('retries without filePath when previous object key is missing', async () => {
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
    expect(update).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith('Seed media update fallback for missing object key: platform/rehab-physio.jpg')

    const firstCall = update.mock.calls[0]?.[0] as Record<string, unknown>
    const secondCall = update.mock.calls[1]?.[0] as Record<string, unknown>

    expect(firstCall.filePath).toBe('/tmp/rehab-physio.jpg')
    expect(secondCall.filePath).toBeUndefined()
  })
})
