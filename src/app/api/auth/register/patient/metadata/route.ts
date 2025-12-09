import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

// Ensures newly created Supabase accounts get user_type 'patient' before the user attempts to log in.
// The email check keeps the endpoint scoped to the freshly created account and makes retries safe.
const bodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  email: z.string().email('A valid email is required'),
})

export async function POST(request: Request) {
  const payloadClient = await getPayload({ config: configPromise })

  try {
    const rawBody = await request.json()
    const parsed = bodySchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { userId, email } = parsed.data
    const supabase = await createAdminClient()

    const { data, error } = await supabase.auth.admin.getUserById(userId)

    if (error || !data.user) {
      return NextResponse.json({ error: 'Unable to locate Supabase user' }, { status: 404 })
    }

    const supabaseUser = data.user

    if (!supabaseUser.email || supabaseUser.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email address mismatch' }, { status: 403 })
    }

    const currentType = supabaseUser.app_metadata?.user_type
    if (currentType === 'patient') {
      return NextResponse.json({ success: true })
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(supabaseUser.app_metadata || {}),
        user_type: 'patient',
      },
    })

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update Supabase metadata' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    payloadClient.logger.error({ error }, 'patient metadata update error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
