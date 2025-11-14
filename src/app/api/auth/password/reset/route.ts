import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/auth/utilities/supaBaseServer'

const requestSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    // Redirect to callback route which handles PKCE code exchange
    const redirectTo = `${baseUrl}/auth/callback?next=/auth/password/reset/complete`

    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
      redirectTo,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password reset request failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
