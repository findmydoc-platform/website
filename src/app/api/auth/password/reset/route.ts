import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/auth/utilities/supaBaseServer'
import { getServerLogger } from '@/utilities/logging/serverLogger'
import { createScopedLogger, getRequestLogContext, hashLogValue } from '@/utilities/logging/shared'

const requestSchema = z.object({
  email: z.string().email(),
})

const toLoggedError = (error: unknown): Error => {
  if (error instanceof Error) return error

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return new Error(typeof message === 'string' ? message : String(message ?? error))
  }

  return new Error(String(error))
}

export async function POST(request: NextRequest) {
  const logger = createScopedLogger(await getServerLogger(), {
    scope: 'auth.supabase',
    ...getRequestLogContext({ request, headers: request.headers }),
  })
  let requestedEmail: string | null = null

  try {
    const body = await request.json().catch(() => null)
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
    }

    requestedEmail = validation.data.email
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    // Redirect to callback route which handles PKCE code exchange
    const redirectTo = `${baseUrl}/auth/callback?next=/auth/password/reset/complete`

    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
      redirectTo,
    })

    if (error) {
      logger.warn(
        {
          emailHash: hashLogValue(validation.data.email),
          err: toLoggedError(error),
          event: 'auth.supabase.password_reset.rejected',
        },
        'Password reset request was rejected by Supabase',
      )
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(
      {
        emailHash: requestedEmail ? hashLogValue(requestedEmail) : undefined,
        err: toLoggedError(error),
        event: 'auth.supabase.password_reset.failed',
      },
      'Password reset request failed',
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
