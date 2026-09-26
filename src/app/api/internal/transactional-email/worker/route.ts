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
  try {
    const { runHostedTransactionalEmailWorker } = await import('@/features/transactionalEmail/hostedScheduler')
    await runHostedTransactionalEmailWorker(deadline)
    return Response.json({ ok: true }, { headers: noStore })
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: noStore })
  }
}

export async function POST(request: Request) {
  if (!authenticated(request)) return new Response(null, { status: 401, headers: noStore })
  return new Response(null, { status: 405, headers: noStore })
}

export const HEAD = POST
