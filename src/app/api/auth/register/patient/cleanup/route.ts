import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

// Provides a best-effort rollback path when metadata provisioning fails during signup.
const payloadSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  email: z.string().email('A valid email is required'),
})

export async function POST(request: Request) {
  const payloadClient = await getPayload({ config: configPromise })

  try {
    const rawBody = await request.json()
    const parsed = payloadSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { userId, email } = parsed.data
    const supabase = await createAdminClient()

    const { data, error } = await supabase.auth.admin.getUserById(userId)

    if (error) {
      return NextResponse.json({ error: 'Unable to verify Supabase user' }, { status: 500 })
    }

    const supabaseUser = data.user

    if (!supabaseUser) {
      // Already cleaned up
      return NextResponse.json({ success: true })
    }

    if (!supabaseUser.email || supabaseUser.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email address mismatch' }, { status: 403 })
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to remove Supabase user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    payloadClient.logger.error({ error }, 'patient cleanup error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
