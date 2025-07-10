import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import {
  validateRegistrationData,
  createSupabaseUser,
  type BaseRegistrationData,
  type SupabaseUserConfig,
} from './registration'

// Base registration handler configuration
export interface RegistrationHandlerConfig<T extends BaseRegistrationData> {
  createUserConfig: (data: T) => SupabaseUserConfig
  createPayloadRecords: (payload: any, supabaseUserId: string, data: T) => Promise<any>
  successMessage: string
  errorContext: string
}

// Generic registration handler
export async function baseRegistrationHandler<T extends BaseRegistrationData>(
  request: Request,
  config: RegistrationHandlerConfig<T>,
) {
  try {
    const registrationData: T = await request.json()

    const validationError = validateRegistrationData(registrationData)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // Create Supabase user
    const userConfig = config.createUserConfig(registrationData)
    const supabaseUser = await createSupabaseUser(userConfig)

    const payload = await getPayload({ config: configPromise })

    // Create corresponding records in Payload CMS
    try {
      await config.createPayloadRecords(payload, supabaseUser.id, registrationData)
      console.log(`Created payload records for Supabase user: ${supabaseUser.id}`)
    } catch (payloadError) {
      console.error(`Failed to create ${config.errorContext} records in Payload:`, payloadError)
      // For patient registration, continue even if Payload fails
      // For clinic staff or full clinic registration, this is critical
      if (
        config.errorContext === 'clinic staff' ||
        config.errorContext === 'clinic registration'
      ) {
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      userId: supabaseUser.id,
      message: config.successMessage,
    })
  } catch (error: any) {
    console.error(`Unexpected error in ${config.errorContext} registration API:`, error)

    // Centralized error handling
    if (error.message && error.message.includes('Supabase')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { error: `Failed to create ${config.errorContext} account` },
      { status: 500 },
    )
  }
}
