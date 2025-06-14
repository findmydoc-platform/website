import payload from 'payload'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * API endpoint for patient user creation using Supabase Admin API
 * This handles creating patient users securely on the server
 */
export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName, dateOfBirth, phone } = await request.json()

    // Basic validation
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create admin client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    // Create patient user with admin API - REQUIRE email confirmation
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        phone: phone,
      },
      app_metadata: {
        user_type: 'patient', // Set patient role directly
      },
      email_confirm: false, // Require email confirmation for patients
    })

    if (error) {
      console.error('Failed to create patient user:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create corresponding Patient record in Payload CMS
    try {
      const patientData = {
        email,
        supabaseUserId: data.user.id,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth || undefined,
        phoneNumber: phone || undefined,
      }

      const patientRecord = await payload.create({
        collection: 'patients',
        data: patientData,
      })

      console.log(`Created patient record: ${patientRecord.id} for Supabase user: ${data.user.id}`)
    } catch (payloadError) {
      console.error('Failed to create patient record in Payload:', payloadError)
      // Continue - the Supabase user is created, the CMS record can be created later via auth flow
    }

    return NextResponse.json({
      success: true,
      userId: data.user.id,
      message:
        'Patient user created successfully. Please check your email to confirm your account.',
    })
  } catch (error: any) {
    console.error('Unexpected error in patient registration API:', error)
    return NextResponse.json({ error: 'Failed to create patient user' }, { status: 500 })
  }
}
