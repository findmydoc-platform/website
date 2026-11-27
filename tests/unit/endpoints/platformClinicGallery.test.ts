import { describe, expect, it } from 'vitest'
import { platformClinicGalleryAppendHandler } from '@/endpoints/platformClinicGallery'
import { clinicGalleryConstraints } from '@/features/clinicDashboard/gallery/contracts'
import { canonicalizeDescriptionText } from '@/features/clinicDashboard/profile/richText'
import { mockUsers } from '../helpers/mockUsers'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

async function appendImage({
  alt,
  caption = '',
  gallerySize = 0,
}: {
  alt: string
  caption?: string
  gallerySize?: number
}) {
  const payload = createMockPayload()
  const clinicId = 20
  const imageId = 30
  const images = Array.from({ length: gallerySize }, (_, index) => ({
    id: index + 1,
    clinic: clinicId,
    status: 'published',
    filename: `gallery-fixture-${index}.png`,
    alt: `Existing image ${index + 1}`,
  }))
  const clinic = { id: clinicId, profileGallery: images.map(({ id }) => id), profileRevision: 8 }
  const selectedImage = { id: imageId, clinic: clinicId, alt, caption: canonicalizeDescriptionText(caption) }
  payload.findByID.mockImplementation(async ({ collection }: { collection: string }) => {
    if (collection === 'platformStaff') return { role: 'admin' }
    if (collection === 'clinicMedia') return selectedImage
    if (collection === 'clinics') return clinic
    throw new Error('Unexpected collection lookup in gallery endpoint test.')
  })
  payload.find.mockImplementation(async ({ where }: { where: { and?: Array<{ status?: { equals: string } }> } }) => ({
    docs: where.and?.some((filter) => filter.status?.equals === 'published') ? images : [],
  }))
  const req = createMockReq(mockUsers.platform(), payload, {
    headers: new Headers({ 'Content-Type': 'application/json' }),
    routeParams: { id: String(imageId) },
  })

  const response = await platformClinicGalleryAppendHandler(req)
  expect(response.status).toBe(422)
  expect(payload.update).not.toHaveBeenCalled()
  const body = (await response.json()) as { error: string }
  expect(body.error).toEqual(expect.any(String))
  expect(body.error.trim()).not.toBe('')
  return body.error
}

describe('platform clinic gallery append endpoint', () => {
  it('distinguishes a full gallery, missing alt text, overlong alt text, and an overlong caption', async () => {
    const errors = await Promise.all([
      appendImage({ alt: 'Valid description', gallerySize: clinicGalleryConstraints.maxItems }),
      appendImage({ alt: '   ' }),
      appendImage({ alt: 'a'.repeat(2_001) }),
      appendImage({ alt: 'Valid description', caption: 'b'.repeat(10_001) }),
    ])

    expect(new Set(errors).size).toBe(errors.length)
  })
})
