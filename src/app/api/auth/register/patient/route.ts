import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { createAdminClient, createClient } from '@/auth/utilities/supaBaseServer'
import configPromise from '@/payload.config'
import { hashLogValue, toLoggedError } from '@/utilities/logging/shared'
import type { User } from '@supabase/supabase-js'
import { getPayload } from 'payload'

const REGISTRATION_ERROR = 'Registration failed'
const PROVISIONING_ERROR = 'We could not finish setting up your account. Please try again in a few minutes.'

const bodySchema = z.object({
  email: z.string().email('A valid email is required').transform(normalizeEmail),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
})

const isObfuscatedExistingUser = (user: User): boolean => Array.isArray(user.identities) && user.identities.length === 0

export async function POST(request: Request) {
  const payloadClient = await getPayload({ config: configPromise })

  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { email, firstName, lastName, password } = parsed.data
    const signupClient = await createClient()
    const { data, error } = await signupClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    })

    if (error) {
      payloadClient.logger.warn(
        {
          emailHash: hashLogValue(email),
          err: toLoggedError(error),
          event: 'auth.supabase.patient_registration.signup_failed',
        },
        'Patient Supabase signup failed',
      )
      return NextResponse.json({ error: REGISTRATION_ERROR }, { status: 400 })
    }

    const supabaseUser = data.user

    if (!supabaseUser?.id) {
      payloadClient.logger.error(
        {
          emailHash: hashLogValue(email),
          event: 'auth.supabase.patient_registration.signup_missing_user',
        },
        'Patient Supabase signup returned no user payload',
      )
      return NextResponse.json({ error: PROVISIONING_ERROR }, { status: 500 })
    }

    if (isObfuscatedExistingUser(supabaseUser)) {
      payloadClient.logger.info(
        {
          emailHash: hashLogValue(email),
          event: 'auth.supabase.patient_registration.signup_obfuscated_existing_user',
        },
        'Patient Supabase signup returned an obfuscated existing user',
      )
      return NextResponse.json({ success: true })
    }

    if (!supabaseUser.email || normalizeEmail(supabaseUser.email) !== email) {
      payloadClient.logger.error(
        {
          emailHash: hashLogValue(email),
          event: 'auth.supabase.patient_registration.signup_email_mismatch',
          supabaseUserId: supabaseUser.id,
          supabaseUserEmailHash: supabaseUser.email ? hashLogValue(normalizeEmail(supabaseUser.email)) : undefined,
        },
        'Patient Supabase signup returned an unexpected user email',
      )
      return NextResponse.json({ error: PROVISIONING_ERROR }, { status: 500 })
    }

    try {
      const adminClient = await createAdminClient()
      const { error: updateError } = await adminClient.auth.admin.updateUserById(supabaseUser.id, {
        app_metadata: {
          ...(supabaseUser.app_metadata || {}),
          user_type: 'patient',
        },
      })

      if (updateError) {
        payloadClient.logger.error(
          {
            emailHash: hashLogValue(email),
            err: toLoggedError(updateError),
            event: 'auth.supabase.patient_registration.metadata_update_failed',
            supabaseUserId: supabaseUser.id,
          },
          'Patient Supabase metadata update failed',
        )
        return NextResponse.json({ error: PROVISIONING_ERROR }, { status: 500 })
      }
    } catch (error) {
      payloadClient.logger.error(
        {
          emailHash: hashLogValue(email),
          err: toLoggedError(error),
          event: 'auth.supabase.patient_registration.metadata_update_failed',
          supabaseUserId: supabaseUser.id,
        },
        'Patient Supabase metadata update failed',
      )
      return NextResponse.json({ error: PROVISIONING_ERROR }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    payloadClient.logger.error(
      {
        err: toLoggedError(error),
        event: 'auth.supabase.patient_registration.failed',
      },
      'Patient registration failed',
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
