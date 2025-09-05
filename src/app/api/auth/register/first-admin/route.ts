import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { validateFirstAdminCreation, type BaseRegistrationData } from '@/auth/utilities/registration'

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })

  try {
    const registrationData: BaseRegistrationData = await request.json()

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
    const firstAdminValidationError = await validateFirstAdminCreation()
    if (firstAdminValidationError) {
      return NextResponse.json({ error: firstAdminValidationError }, { status: 400 })
    }

    const basicUserRecord = await payload.create({
      collection: 'basicUsers',
      data: {
        email: registrationData.email,
        userType: 'platform',
        password: registrationData.password,
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
      },
      context: {
        // Pass user metadata for Supabase user creation
        userMetadata: {
          firstName: registrationData.firstName,
          lastName: registrationData.lastName,
        },
      },
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      userId: basicUserRecord.id,
      message: 'First admin user created successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error in first-admin API:', error)

    if (error.message && error.message.includes('Supabase')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 })
  }
}
