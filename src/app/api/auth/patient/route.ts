import payload from 'payload'
import { NextResponse } from 'next/server'
import {
  validateRegistrationData,
  createSupabaseUser,
  createPatientUserConfig,
  createPatientRecord,
  type PatientRegistrationData,
} from '@/utilities/auth/registration'

/**
 * API endpoint for patient user creation using Supabase Admin API
 * This handles creating patient users securely on the server
 */
export async function POST(request: Request) {
  try {
    const registrationData: PatientRegistrationData = await request.json()

    // Validate required fields
    const validationError = validateRegistrationData(registrationData)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // Create Supabase user
    const userConfig = createPatientUserConfig(registrationData)
    const supabaseUser = await createSupabaseUser(userConfig)

    // Create corresponding Patient record in Payload CMS
    try {
      const patientRecord = await createPatientRecord(payload, supabaseUser.id, registrationData)
      console.log(
        `Created patient record: ${patientRecord.id} for Supabase user: ${supabaseUser.id}`,
      )
    } catch (payloadError) {
      console.error('Failed to create patient record in Payload:', payloadError)
      // Continue - the Supabase user is created, the CMS record can be created later via auth flow
    }

    return NextResponse.json({
      success: true,
      userId: supabaseUser.id,
      message:
        'Patient user created successfully. Please check your email to confirm your account.',
    })
  } catch (error: any) {
    console.error('Unexpected error in patient registration API:', error)

    // More specific error handling
    if (error.message && error.message.includes('Supabase')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to create patient user' }, { status: 500 })
  }
}
