import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createLocalReq, getPayload } from 'payload'
import configPromise from '@/payload.config'
import { requestPasswordRecovery } from '@/auth/actions/passwordRecoveryRequests'
import { websiteRecoveryContext } from '@/auth/actions/recoveryContext'

const requestSchema = z.object({ email: z.string().trim().email().max(254) }).strict()

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' }
  const validation = requestSchema.safeParse(await request.json().catch(() => null))
  if (!validation.success)
    return Response.json({ error: 'Please provide a valid email address.' }, { status: 400, headers })
  try {
    const payload = await getPayload({ config: configPromise })
    const req = await createLocalReq({}, payload)
    await requestPasswordRecovery(req, { email: validation.data.email, context: websiteRecoveryContext(request) })
  } catch {
    // Eligibility, limits, inactive environments and infrastructure failures share one public response.
  }
  return Response.json({ success: true }, { headers })
}
