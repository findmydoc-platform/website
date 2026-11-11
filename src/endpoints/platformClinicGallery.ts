import { APIError, type PayloadHandler } from 'payload'
import { appendPlatformClinicGalleryMedia } from '@/features/clinicDashboard/gallery/platformGallery'
import { ClinicGalleryServiceError } from '@/features/clinicDashboard/gallery/service'

export const platformClinicGalleryAppendHandler: PayloadHandler = async (req) => {
  const id = req.routeParams?.id
  if (req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return Response.json({ error: 'JSON is required.' }, { status: 415, headers: { 'Cache-Control': 'no-store' } })
  }
  if (typeof id !== 'string' || !/^[1-9]\d*$/u.test(id) || !Number.isSafeInteger(Number(id))) {
    return Response.json({ error: 'Invalid image ID.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const snapshot = await appendPlatformClinicGalleryMedia(req, Number(id))
    return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof APIError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
    }
    if (error instanceof ClinicGalleryServiceError) {
      const status =
        error.kind === 'conflict' ? 409 : error.kind === 'not-found' ? 404 : error.kind === 'unavailable' ? 503 : 422
      return Response.json({ error: error.message }, { status, headers: { 'Cache-Control': 'no-store' } })
    }
    req.payload.logger.error({ event: 'platform_clinic_gallery.append_failed' }, 'Clinic gallery update failed')
    return Response.json(
      { error: 'The image could not be added.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
