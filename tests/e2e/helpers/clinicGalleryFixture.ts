import { expect, type APIRequestContext } from '@playwright/test'
import sharp from 'sharp'
import { getRecordId, type CreatedDocResponse } from './adminApi'

export async function createClinicGalleryFixture(request: APIRequestContext) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const clinicResponse = await request.post('/api/clinics', { data: { name: `E2E Gallery ${suffix}` } })
  expect(clinicResponse.ok()).toBeTruthy()
  const clinicId = getRecordId(((await clinicResponse.json()) as CreatedDocResponse).doc?.id)
  if (!clinicId) throw new Error('Clinic fixture has no ID')
  try {
    const image = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#778899' } })
      .png()
      .toBuffer()
    const mediaResponse = await request.post('/api/clinicMedia', {
      multipart: {
        _payload: JSON.stringify({ clinic: clinicId, alt: 'Synthetic gallery image' }),
        file: { buffer: image, mimeType: 'image/png', name: `e2e-gallery-${suffix}.png` },
      },
    })
    expect(mediaResponse.ok()).toBeTruthy()
    const mediaId = getRecordId(((await mediaResponse.json()) as CreatedDocResponse).doc?.id)
    if (!mediaId) throw new Error('Gallery image fixture has no ID')
    return { clinicId, mediaId }
  } catch (error) {
    await request.delete(`/api/clinics/${clinicId}?trash=true`)
    throw error
  }
}

export async function removeClinicGalleryFixture(
  request: APIRequestContext,
  fixture: { clinicId: string | number; mediaId: string | number },
) {
  const unlink = await request.patch(`/api/clinics/${fixture.clinicId}`, { data: { profileGallery: [] } })
  expect(unlink.ok()).toBeTruthy()
  const media = await request.delete(`/api/clinicMedia/${fixture.mediaId}?trash=true`)
  expect(media.ok()).toBeTruthy()
  const clinic = await request.delete(`/api/clinics/${fixture.clinicId}?trash=true`)
  expect(clinic.ok()).toBeTruthy()
}
