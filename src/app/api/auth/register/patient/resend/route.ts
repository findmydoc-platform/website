import { NextResponse } from 'next/server'
import { createLocalReq, getPayload } from 'payload'
import { z } from 'zod'
import configPromise from '@/payload.config'
import { resendPatientVerification } from '@/auth/actions/patientVerificationRequests'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { PREVIEW_GUARD_ACTIVE_REQUEST_HEADER } from '@/features/previewGuard'

const schema = z.object({ email: z.string().email().max(254).transform(normalizeEmail) }).strict()
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return response({ error: 'Request rejected.' }, 403)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return response({ error: 'Enter a valid email address.' }, 400)
  if (request.headers.get(PREVIEW_GUARD_ACTIVE_REQUEST_HEADER) !== '1') {
    try {
      const payload = await getPayload({ config: configPromise })
      await resendPatientVerification(await createLocalReq({}, payload), parsed.data)
    } catch {
      // Account eligibility, throttling and infrastructure failures share one neutral public response.
    }
  }
  return response({ success: true })
}
