import payload from 'payload'
import { NextResponse } from 'next/server'
import {
  validateRegistrationData,
  createSupabaseUser,
  createClinicStaffUserConfig,
  createClinicStaffRecords,
  type ClinicStaffRegistrationData,
} from '@/utilities/auth/registration'

/**
 * API endpoint for clinic staff registration using Supabase Admin API
 * Creates clinic staff with pending approval status
 */
export async function POST(request: Request) {
  try {
    const registrationData: ClinicStaffRegistrationData = await request.json()

    // Validate required fields
    const validationError = validateRegistrationData(registrationData)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // Create Supabase user
    const userConfig = createClinicStaffUserConfig(registrationData)
    const supabaseUser = await createSupabaseUser(userConfig)

    // Create corresponding BasicUser and ClinicStaff records in Payload CMS
    try {
      const { basicUserRecord, clinicStaffRecord } = await createClinicStaffRecords(
        payload,
        supabaseUser.id,
        registrationData,
      )

      console.log(
        `Created BasicUser record: ${basicUserRecord.id} for Supabase user: ${supabaseUser.id}`,
      )
      console.log(
        `Created ClinicStaff profile: ${clinicStaffRecord.id} for user: ${basicUserRecord.id}`,
      )
    } catch (payloadError) {
      console.error('Failed to create clinic staff records in Payload:', payloadError)
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      userId: supabaseUser.id,
      message:
        'Clinic staff registration successful. Your account is pending approval. Please check your email to confirm your account.',
    })
  } catch (error: any) {
    console.error('Unexpected error in clinic staff registration API:', error)

    // More specific error handling
    if (error.message && error.message.includes('Supabase')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to create clinic staff account' }, { status: 500 })
  }
}
