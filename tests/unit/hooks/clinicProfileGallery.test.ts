import { describe, expect, it, vi } from 'vitest'

import { beforeChangeValidatePublishedClinicMedia } from '@/collections/ClinicMedia/publicationStatus'
import { beforeDeleteRejectReferencedClinicMedia } from '@/collections/ClinicMedia/deletionGuard'
import {
  beforeChangeSynchronizeClinicProfileGallery,
  clinicProfileGalleryMaxItems,
} from '@/collections/clinics/profileGallery'

const buildReq = (media: Array<{ id: number; clinic: number; status: 'draft' | 'published' }> = []) =>
  ({
    payload: {
      find: vi.fn().mockResolvedValue({ docs: media }),
    },
  }) as never

describe('clinic profile gallery hooks', () => {
  it('derives the thumbnail from the first ordered published image', async () => {
    const data = { profileGallery: [3, 2] }
    const result = await beforeChangeSynchronizeClinicProfileGallery({
      data,
      operation: 'update',
      originalDoc: { id: 1 },
      req: buildReq([
        { id: 2, clinic: 1, status: 'published' },
        { id: 3, clinic: 1, status: 'published' },
      ]),
    } as never)

    expect(result).toMatchObject({ profileGallery: [3, 2], thumbnail: 3 })
  })

  it.each([
    ['duplicates', [2, 2]],
    ['too many images', Array.from({ length: clinicProfileGalleryMaxItems + 1 }, (_, index) => index + 2)],
  ])('rejects %s', async (_label, profileGallery) => {
    await expect(
      beforeChangeSynchronizeClinicProfileGallery({
        data: { profileGallery },
        operation: 'update',
        originalDoc: { id: 1 },
        req: buildReq(),
      } as never),
    ).rejects.toThrow('Profile gallery')
  })

  it('rejects draft and foreign media', async () => {
    await expect(
      beforeChangeSynchronizeClinicProfileGallery({
        data: { profileGallery: [2, 3] },
        operation: 'update',
        originalDoc: { id: 1 },
        req: buildReq([
          { id: 2, clinic: 1, status: 'draft' },
          { id: 3, clinic: 9, status: 'published' },
        ]),
      } as never),
    ).rejects.toThrow('Profile gallery')
  })

  it('requires non-empty alt text before publication', () => {
    expect(() =>
      beforeChangeValidatePublishedClinicMedia({
        data: { alt: '  ', status: 'published' },
        operation: 'update',
        originalDoc: { id: 2, status: 'draft' },
        req: buildReq(),
      } as never),
    ).toThrow('Alt text')
  })

  it('blocks direct deletion while media remains referenced by a clinic', async () => {
    const req = {
      payload: { find: vi.fn().mockResolvedValue({ docs: [{ id: 1 }] }) },
    }

    await expect(beforeDeleteRejectReferencedClinicMedia({ id: 2, req } as never)).rejects.toThrow(
      'Remove this image from the clinic profile gallery before deleting it.',
    )
  })
})
