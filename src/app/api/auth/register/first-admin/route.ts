import payload from 'payload'
import { NextResponse } from 'next/server'
import {
  createSupabaseUser,
  createSupabaseUserConfig,
  validateFirstAdminCreation,
  type BaseRegistrationData,
} from '@/auth/utilities/userManagement'

export async function POST(request: Request) {
  try {
    const registrationData: BaseRegistrationData = await request.json()

    // Only allow creation if no platform users exist yet
    const firstAdminValidationError = await validateFirstAdminCreation()
    if (firstAdminValidationError) {
      return NextResponse.json({ error: firstAdminValidationError }, { status: 400 })
    }

    // Create Supabase user with platform role
    const userConfig = createSupabaseUserConfig(registrationData, 'platform')
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
