import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/auth/utilities/supaBaseServer'
import { getSupabaseLogger } from '@/auth/utilities/supabaseLogger'
import { z } from 'zod'
import { toLoggedError } from '@/utilities/logging/shared'

const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
  allowedUserTypes: z.array(z.enum(['patient', 'clinic', 'platform'])).min(1),
})

export async function POST(request: NextRequest) {
  const logger = await getSupabaseLogger({
    headers: request.headers,
    request,
    bindings: {
      component: 'login-route',
    },
  })

  try {
    const body = await request.json()

    // Validate request body
    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { email, password, allowedUserTypes } = validation.data
    const supabase = await createClient()

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error: authError?.message || 'Authentication failed',
        },
        { status: 401 },
      )
    }

    // Verify user type is one of the allowed types
    const tokenUserType = authData.user.app_metadata?.user_type
    if (!allowedUserTypes.includes(tokenUserType)) {
      // Sign out the user since they're not authorized for this endpoint
      await supabase.auth.signOut()

      const allowedTypesText = allowedUserTypes.join(' or ')
      return NextResponse.json(
        {
          error: `This login is for ${allowedTypesText} users only. Please use the correct login page.`,
        },
        { status: 403 },
      )
    }

    // For clinic users, verify they are approved (handled by auth strategy)
    // The auth strategy will do the final verification

    // Determine redirect URL based on user type
    const redirectUrl = tokenUserType === 'patient' ? '/patient/dashboard' : '/admin'

    return NextResponse.json({
      success: true,
      redirectUrl,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        userType: tokenUserType,
      },
    })
  } catch (error) {
    logger.error(
      {
        err: toLoggedError(error),
        event: 'auth.supabase.login_route.failed',
      },
      'Login API error',
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
