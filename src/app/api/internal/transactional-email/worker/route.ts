import { createHash, timingSafeEqual } from 'node:crypto'
import { schedulerInvocationBudgetMilliseconds } from '@/features/transactionalEmail/scheduler'

export const runtime = 'nodejs'
export const maxDuration = 300

const noStore = { 'Cache-Control': 'no-store' }

function authenticated(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 32) return false
  const supplied = createHash('sha256')
    .update(request.headers.get('authorization') ?? '')
    .digest()
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest()
  return timingSafeEqual(supplied, expected)
}

export async function GET(request: Request) {
  if (!authenticated(request)) return new Response(null, { status: 401, headers: noStore })
  const deadline = Date.now() + schedulerInvocationBudgetMilliseconds
  let failed = false
  try {
    const { runHostedRecoveryRetention } = await import('@/auth/actions/hostedRecoveryRetention')
    await runHostedRecoveryRetention(deadline)
  } catch {
    failed = true
  }
  try {
    const { runHostedTransactionalEmailWorker } = await import('@/features/transactionalEmail/hostedScheduler')
    await runHostedTransactionalEmailWorker(deadline)
  } catch {
    failed = true
  }
  return Response.json({ ok: !failed }, { status: failed ? 503 : 200, headers: noStore })
}

export async function POST(request: Request) {
  if (!authenticated(request)) return new Response(null, { status: 401, headers: noStore })
  return new Response(null, { status: 405, headers: noStore })
}

export const HEAD = POST
