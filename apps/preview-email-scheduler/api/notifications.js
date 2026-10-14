import { createHash, timingSafeEqual } from 'node:crypto'

const previewRetention = 'https://preview.findmydoc.eu/api/internal/clinic-notifications/preview-retention'
const noStore = { 'Cache-Control': 'no-store' }

/** @param {'configuration_unavailable' | 'upstream_unavailable' | 'transport_unavailable'} failureKind */
function failed(failureKind) {
  try {
    console.error({
      event: 'clinic_dashboard.notifications.preview_retention_relay',
      application: 'preview-scheduler',
      environment: 'preview',
      result: 'failure',
      failureKind,
    })
  } catch {
    /* The relay response must survive logging failure. */
  }
  return Response.json({ ok: false }, { status: 503, headers: noStore })
}

export default {
  /** @param {Request} request @returns {Promise<Response>} */
  async fetch(request) {
    const secret = process.env.CRON_SECRET
    if (!secret || secret.length < 32) return new Response(null, { status: 401, headers: noStore })
    const supplied = createHash('sha256')
      .update(request.headers.get('authorization') ?? '')
      .digest()
    const expected = createHash('sha256').update(`Bearer ${secret}`).digest()
    if (!timingSafeEqual(supplied, expected)) return new Response(null, { status: 401, headers: noStore })
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: noStore })

    if (
      process.env.VERCEL_ENV !== 'production' ||
      process.env.SCHEDULER_ENVIRONMENT !== 'preview' ||
      process.env.PREVIEW_NOTIFICATION_RETENTION_URL !== previewRetention
    ) {
      return failed('configuration_unavailable')
    }

    const relaySecret = process.env.PREVIEW_NOTIFICATION_RETENTION_SECRET
    if (!relaySecret || relaySecret.length < 32) return failed('configuration_unavailable')

    try {
      const response = await fetch(previewRetention, {
        method: 'GET',
        headers: { Authorization: `Bearer ${relaySecret}` },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(240_000),
      })
      await response.body?.cancel()
      if (!response.ok) return failed('upstream_unavailable')
      return Response.json({ ok: true }, { headers: noStore })
    } catch {
      return failed('transport_unavailable')
    }
  },
}
