import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { validateFirstAdminCreation, type BaseRegistrationData } from '@/auth/utilities/registration'
import { createSupabaseAccountWithPassword, deleteSupabaseAccount } from '@/auth/utilities/supabaseProvision'
import { createScopedLogger, getRequestLogContext, hashLogValue } from '@/utilities/logging/shared'

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const logger = createScopedLogger(payload.logger, {
    scope: 'auth.supabase',
    ...getRequestLogContext({ request, headers: request.headers }),
  })
  let registrationEmail: string | null = null
  let supabaseUserId: string | null = null

  try {
    const registrationData: BaseRegistrationData = await request.json()
    registrationEmail = registrationData.email

    // Quick Payload-side guard: if a platform BasicUser already exists, block creation
    const existingPlatform = await payload.find({
      collection: 'basicUsers',
      where: {
        userType: { equals: 'platform' },
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existingPlatform.docs.length > 0) {
      return NextResponse.json({ error: 'At least one Admin user already exists' }, { status: 400 })
    }

    // Idempotency by email: if a BasicUser with same email exists, reject
    const existingByEmail = await payload.find({
      collection: 'basicUsers',
      where: {
        email: { equals: registrationData.email },
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existingByEmail.docs.length > 0) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    // Only allow creation if no platform users exist yet
    const firstAdminValidationError = await validateFirstAdminCreation(logger)
    if (firstAdminValidationError) {
      return NextResponse.json({ error: firstAdminValidationError }, { status: 400 })
    }

    if (!registrationData.password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    supabaseUserId = await createSupabaseAccountWithPassword(
      {
        email: registrationData.email,
        password: registrationData.password,
        userType: 'platform',
        userMetadata: {
          firstName: registrationData.firstName,
          lastName: registrationData.lastName,
        },
      },
      logger,
    )

    const basicUserRecord = await payload.create({
      collection: 'basicUsers',
      data: {
        email: registrationData.email,
        userType: 'platform',
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        supabaseUserId,
      },
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      userId: basicUserRecord.id,
      message: 'First admin user created successfully',
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error(
      {
        emailHash: registrationEmail ? hashLogValue(registrationEmail) : undefined,
        err,
        event: 'auth.supabase.first_admin.failed',
        supabaseUserId,
      },
      'Unexpected error during first-admin provisioning',
    )

    if (supabaseUserId) {
      try {
        const deleted = await deleteSupabaseAccount(supabaseUserId)
        if (!deleted) {
          logger.error(
            {
              event: 'auth.supabase.first_admin.cleanup_failed',
              supabaseUserId,
            },
            'Failed to cleanup Supabase user after provisioning error',
          )
        }
      } catch (cleanupError: unknown) {
        const cleanupErr = cleanupError as Error
        logger.error(
          {
            err: cleanupErr,
            event: 'auth.supabase.first_admin.cleanup_failed',
            supabaseUserId,
          },
          'Cleanup error while deleting Supabase user',
        )
      }
    }

    if (err.message && err.message.includes('Supabase')) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 })
  }
}
