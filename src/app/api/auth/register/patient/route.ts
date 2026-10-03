import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLocalReq, getPayload } from 'payload'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { requestPatientVerification } from '@/auth/actions/patientVerificationRequests'
import configPromise from '@/payload.config'
import { hashLogValue } from '@/utilities/logging/shared'
import { PREVIEW_GUARD_ACTIVE_REQUEST_HEADER } from '@/features/previewGuard'

const bodySchema = z
  .object({
    email: z.string().email().max(254).transform(normalizeEmail),
    password: z.string().min(6).max(4096),
    firstName: z.string().trim().min(1).max(200),
    lastName: z.string().trim().min(1).max(200),
  })
  .strict()

export async function POST(request: Request) {
  if (request.headers.get(PREVIEW_GUARD_ACTIVE_REQUEST_HEADER) === '1') {
    return NextResponse.json(
      { error: 'Patient accounts are created by platform staff while Preview Guard is active.' },
      { status: 403 },
    )
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  const payload = await getPayload({ config: configPromise })
  try {
    const req = await createLocalReq({}, payload)
    await requestPatientVerification(req, parsed.data)
    return NextResponse.json({ success: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unavailable'
    payload.logger.warn(
      { event: 'auth.patient_verification.unavailable', emailHash: hashLogValue(parsed.data.email) },
      'Patient verification request could not be accepted',
    )
    // Do not expose whether an identity exists, is confirmed, or belongs to another account type.
    if (code === 'identity-unavailable' || code === 'rate-limited') return NextResponse.json({ success: true })
    return NextResponse.json(
      { error: 'Registration is temporarily unavailable. Please try again later.' },
      { status: 503 },
    )
  }
}
