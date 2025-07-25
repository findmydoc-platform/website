import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import {
  createSupabaseUser,
  type BaseRegistrationData,
  type SupabaseUserConfig,
} from './registration'

// Base registration handler configuration
export interface RegistrationHandlerConfig<T extends BaseRegistrationData> {
  createUserConfig: (data: T, userType: string) => SupabaseUserConfig
  createPayloadRecords: (payload: any, supabaseUserId: string, data: T) => Promise<any>
  successMessage: string
  errorContext: string
}

// Generic registration handler
export async function baseRegistrationHandler<T extends BaseRegistrationData>(
  request: Request,
  config: RegistrationHandlerConfig<T>,
  userType: string,
) {
  try {
    const registrationData: T = await request.json()

    // Create Supabase user
    const userConfig = config.createUserConfig(registrationData, userType)
    const supabaseUser = await createSupabaseUser(userConfig)

    const payload = await getPayload({ config: configPromise })

    try {
      await config.createPayloadRecords(payload, supabaseUser.id, registrationData)
      console.log(`Created payload records for Supabase user: ${supabaseUser.id}`)
    } catch (error) {
      console.error(`Failed to create ${config.errorContext} records in Payload:`, error)
      
      // For patient registration, continue even if Payload fails
      // For full clinic registration, this is critical
      if (config.errorContext === 'clinic registration') {
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
