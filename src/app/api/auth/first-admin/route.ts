import payload from 'payload'
import { NextResponse } from 'next/server'
import {
  validateRegistrationData,
  createSupabaseUser,
  createPlatformStaffUserConfig,
  validateFirstAdminCreation,
  type PlatformStaffRegistrationData,
} from '@/auth/utilities/registration'

export async function POST(request: Request) {
  try {
    const registrationData: PlatformStaffRegistrationData = await request.json()

    // Validate required fields
    const validationError = validateRegistrationData(registrationData)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // Only allow creation if no platform users exist yet
    const firstAdminValidationError = await validateFirstAdminCreation()
    if (firstAdminValidationError) {
      return NextResponse.json({ error: firstAdminValidationError }, { status: 400 })
    }

    // Create Supabase user with platform role
    const userConfig = createPlatformStaffUserConfig(registrationData)
    const supabaseUser = await createSupabaseUser(userConfig)

    return NextResponse.json({
      success: true,
      userId: supabaseUser.id,
      message: 'First admin user created successfully',
    })
  } catch (error: any) {
    payload.logger.error('Unexpected error in first-admin API:', error)

    if (error.message && error.message.includes('Supabase')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 })
  }
}
