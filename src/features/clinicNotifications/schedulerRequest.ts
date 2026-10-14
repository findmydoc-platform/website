import { createHash, timingSafeEqual } from 'node:crypto'
import { resolveServerRuntimeEnvironment } from '@/features/runtimePolicy'

const noStore = { 'Cache-Control': 'no-store' }
const notificationRetentionBudgetMs = 220_000

export async function handleNotificationRetentionRequest(
  request: Request,
  environment: 'preview' | 'production',
  method: 'GET' | 'unsupported',
): Promise<Response> {
  const secret =
    environment === 'production' ? process.env.CRON_SECRET : process.env.PREVIEW_NOTIFICATION_RETENTION_SECRET
  if (
    !secret ||
    secret.length < 32 ||
    !timingSafeEqual(
      createHash('sha256')
        .update(request.headers.get('authorization') ?? '')
        .digest(),
      createHash('sha256').update(`Bearer ${secret}`).digest(),
    )
  )
    return new Response(null, { status: 401, headers: noStore })
  if (method !== 'GET') return new Response(null, { status: 405, headers: noStore })
  if (
    resolveServerRuntimeEnvironment() !== environment ||
    process.env.DEPLOYMENT_ENV !== environment ||
    process.env.VERCEL_ENV !== environment
  )
    return Response.json({ ok: false }, { status: 503, headers: noStore })
  const deadline = Date.now() + notificationRetentionBudgetMs
  try {
    const { runHostedClinicNotificationRetention } = await import('./hostedRetention')
    const result = await runHostedClinicNotificationRetention(environment, deadline)
    const ok = result.result === 'success' || result.result === 'busy'
    return Response.json({ ok }, { status: ok ? 200 : 503, headers: noStore })
  } catch {
    try {
      const { recordRetentionCompositionFailure } = await import('./retentionDiagnostics')
      await recordRetentionCompositionFailure(Date.now() - (deadline - notificationRetentionBudgetMs))
    } catch {
      /* Diagnostic failure cannot disclose initialization errors. */
    }
    return Response.json({ ok: false }, { status: 503, headers: noStore })
  }
}
