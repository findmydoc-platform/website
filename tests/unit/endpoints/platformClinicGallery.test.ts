import { describe, expect, it, vi } from 'vitest'
import { platformClinicGalleryAppendHandler } from '@/endpoints/platformClinicGallery'
import { clinicGalleryConstraints } from '@/features/clinicDashboard/gallery/contracts'
import { appendPlatformClinicGalleryMedia } from '@/features/clinicDashboard/gallery/platformGallery'
import { canonicalizeDescriptionText } from '@/features/clinicDashboard/profile/richText'
import {
  DATABASE_TEMPORARILY_UNAVAILABLE_CODE,
  recordPlatformPrincipalLookupFailure,
} from '@/features/databaseAvailability'
import { mockUsers } from '../helpers/mockUsers'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

vi.mock('@/posthog/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/posthog/api')>()),
  sendPostHogException: vi.fn(),
}))

const privateFailure = 'Private database fixture details'

function databaseFailure() {
  return Object.assign(new Error(privateFailure), { code: 'ECONNREFUSED' })
}

async function expectSafeAvailabilityResponse(response: Response, payload: ReturnType<typeof createMockPayload>) {
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  const body = await response.json()
  expect(body).toEqual({
    error: { code: DATABASE_TEMPORARILY_UNAVAILABLE_CODE },
    errors: [{ message: expect.stringMatching(/\S/) }],
  })
  expect(JSON.stringify(body)).not.toContain(privateFailure)
  expect(payload.logger.error).toHaveBeenCalledOnce()
  const loggedContext = payload.logger.error.mock.calls[0]?.[0] as { err: Error }
  expect(loggedContext.err.message).not.toContain(privateFailure)
}

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
  it.each([
    { input: { alt: 'Valid description', gallerySize: clinicGalleryConstraints.maxItems }, hint: 'Profile Gallery' },
    { input: { alt: '   ' }, hint: 'alt text' },
    { input: { alt: 'a'.repeat(2_001) }, hint: '2000' },
    { input: { alt: 'Valid description', caption: 'b'.repeat(10_001) }, hint: '10000' },
  ])('identifies the relevant control or bound in its 422 response ($hint)', async ({ input, hint }) => {
    expect(await appendImage(input)).toContain(hint)
  })

  it.each(['platformStaff', 'clinicMedia'])('safely reports a %s connection error', async (failedCollection) => {
    const payload = createMockPayload()
    payload.findByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === failedCollection) throw databaseFailure()
      return { role: 'admin' }
    })
    const req = createMockReq(mockUsers.platform(), payload, {
      headers: new Headers({ 'Content-Type': 'application/json' }),
      routeParams: { id: '30' },
    })

    await expectSafeAvailabilityResponse(await platformClinicGalleryAppendHandler(req), payload)
  })

  it('distinguishes an unavailable principal lookup from an ordinary unauthenticated request', async () => {
    const payload = createMockPayload()
    const req = createMockReq(null, payload, {
      headers: new Headers({ 'Content-Type': 'application/json' }),
      routeParams: { id: '30' },
      method: 'POST',
      payloadAPI: 'REST',
    })
    const forbidden = await platformClinicGalleryAppendHandler(req)
    expect(forbidden.status).toBe(403)
    expect(payload.logger.error).not.toHaveBeenCalled()

    recordPlatformPrincipalLookupFailure(req, databaseFailure())
    await expectSafeAvailabilityResponse(await platformClinicGalleryAppendHandler(req), payload)
  })

  it('denies an unconfirmed staff lookup for direct gallery callers', async () => {
    const payload = createMockPayload()
    payload.findByID.mockRejectedValue(databaseFailure())
    const req = createMockReq(mockUsers.platform(), payload)

    await expect(appendPlatformClinicGalleryMedia(req, 30)).rejects.toMatchObject({ status: 403 })
  })
})
