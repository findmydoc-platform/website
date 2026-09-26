import { createHash, timingSafeEqual } from 'node:crypto'

const previewWorker = 'https://preview.findmydoc.eu/api/internal/transactional-email/worker'
const noStore = { 'Cache-Control': 'no-store' }

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
      process.env.PREVIEW_WORKER_URL !== previewWorker
    ) {
      return Response.json({ ok: false }, { status: 503, headers: noStore })
    }

    try {
      const response = await fetch(previewWorker, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secret}` },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(250_000),
      })
      await response.body?.cancel()
      if (!response.ok) return Response.json({ ok: false }, { status: 503, headers: noStore })
      return Response.json({ ok: true }, { headers: noStore })
    } catch {
      return Response.json({ ok: false }, { status: 503, headers: noStore })
    }
  },
}
