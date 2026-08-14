import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  cleanupClinicGalleryDraftMedia,
  CLINIC_GALLERY_CLEANUP_BATCH_SIZE,
  CLINIC_GALLERY_CLEANUP_CONCURRENCY,
  CLINIC_GALLERY_CLEANUP_RETRY_DELAYS_MS,
} from '@/features/clinicDashboard/gallery/cleanup'

const sendPostHogException = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/posthog/api', () => ({ sendPostHogException }))

const buildPayload = (deleteImplementation: (id: unknown) => Promise<unknown>) =>
  ({
    findByID: vi.fn(async ({ id }) => ({ id, clinic: 1, status: 'draft' })),
    find: vi.fn(async () => ({ docs: [] })),
    delete: vi.fn(async ({ id }) => deleteImplementation(id)),
    logger: {
      error: vi.fn(),
    },
  }) as unknown as Payload

describe('clinic gallery draft cleanup', () => {
  it('caps a batch at twelve IDs and deletes at most three objects concurrently', async () => {
    let active = 0
    let peak = 0
    const deleted: string[] = []
    const payload = buildPayload(async (id) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      deleted.push(String(id))
      active -= 1
      return {}
    })

    await cleanupClinicGalleryDraftMedia(
      payload,
      1,
      Array.from({ length: 20 }, (_, index) => String(index + 1)),
      'gallery-read',
    )

    expect(deleted).toHaveLength(CLINIC_GALLERY_CLEANUP_BATCH_SIZE)
    expect(peak).toBeLessThanOrEqual(CLINIC_GALLERY_CLEANUP_CONCURRENCY)
  })

  it('rechecks eligibility for every attempt and uses the two retry delays', async () => {
    const payload = buildPayload(async () => {
      throw new Error('S3 unavailable')
    })
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      cleanupClinicGalleryDraftMedia(payload, 1, ['9'], 'discard', {
        random: () => 0.5,
        sleep,
      }),
    ).resolves.toBeUndefined()

    expect(payload.findByID).toHaveBeenCalledTimes(3)
    expect(payload.find).toHaveBeenCalledTimes(3)
    expect(payload.delete).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([...CLINIC_GALLERY_CLEANUP_RETRY_DELAYS_MS])
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptCount: 3,
        event: 'clinic_gallery.media_cleanup_failed',
        mediaId: '9',
        reason: 'discard',
      }),
      'Clinic gallery media cleanup failed',
    )
    expect(sendPostHogException).toHaveBeenCalledOnce()
  })

  it('does not delete a draft that becomes referenced', async () => {
    const payload = buildPayload(async () => ({}))
    vi.mocked(payload.find).mockResolvedValueOnce({ docs: [{ id: 1 }] } as never)

    await cleanupClinicGalleryDraftMedia(payload, 1, ['9'], 'gallery-save')

    expect(payload.delete).not.toHaveBeenCalled()
  })
})
