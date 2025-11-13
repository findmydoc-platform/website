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

    const redirectTo = process.env.NEXT_PUBLIC_SUPABASE_RESET_REDIRECT

    if (!redirectTo) {
      return NextResponse.json(
        { error: 'Password recovery is not configured. Please contact support.' },
        { status: 500 },
      )
    }

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
