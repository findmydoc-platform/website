import { createClient } from '@supabase/supabase-js'
import type payload from 'payload'

/**
 * Registration data types
 */
export interface BaseRegistrationData {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface PatientRegistrationData extends BaseRegistrationData {
  dateOfBirth?: string
  phone?: string
}

export type ClinicStaffRegistrationData = BaseRegistrationData

/**
 * Supabase user creation configuration
 */
export interface SupabaseUserConfig {
  email: string
  password: string
  user_metadata: Record<string, any>
  app_metadata: Record<string, any>
  email_confirm: boolean
}

/**
 * Create a Supabase admin client for user registration
 * Uses the existing pattern but with proper typing
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

/**
 * Validate required fields for registration
 */
export function validateRegistrationData(data: BaseRegistrationData): string | null {
  const { email, password, firstName, lastName } = data

  if (!email || !password || !firstName || !lastName) {
    return 'Missing required fields: email, password, firstName, and lastName are required'
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return 'Invalid email format'
  }

  // Basic password validation
  if (password.length < 6) {
    return 'Password must be at least 6 characters long'
  }

  return null
}

/**
 * Create a Supabase user with common error handling
 */
export async function createSupabaseUser(config: SupabaseUserConfig) {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase.auth.admin.createUser(config)

  if (error) {
    console.error('Failed to create Supabase user:', error)
    throw new Error(`Supabase user creation failed: ${error.message}`)
  }

  if (!data.user) {
    throw new Error('Supabase user creation succeeded but no user data returned')
  }

  return data.user
}

/**
 * Create Supabase user config for patient registration
 */
export function createPatientUserConfig(data: PatientRegistrationData): SupabaseUserConfig {
  return {
    email: data.email,
    password: data.password,
    user_metadata: {
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dateOfBirth,
      phone: data.phone,
    },
    app_metadata: {
      user_type: 'patient',
    },
    email_confirm: false, // Require email confirmation for patients
  }
}

/**
 * Create Supabase user config for clinic staff registration
 */
export function createClinicStaffUserConfig(data: ClinicStaffRegistrationData): SupabaseUserConfig {
  return {
    email: data.email,
    password: data.password,
    user_metadata: {
      first_name: data.firstName,
      last_name: data.lastName,
    },
    app_metadata: {
      user_type: 'clinic',
    },
    email_confirm: false, // Require email confirmation
  }
}

/**
 * Create a patient record in PayloadCMS
 */
export async function createPatientRecord(
  payloadInstance: typeof payload,
  supabaseUserId: string,
  data: PatientRegistrationData,
) {
  const patientData = {
    email: data.email,
    supabaseUserId,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth || undefined,
    phoneNumber: data.phone || undefined,
  }

  return await payloadInstance.create({
    collection: 'patients',
    data: patientData,
  })
}

/**
 * Create basic user and clinic staff records in PayloadCMS
 */
export async function createClinicStaffRecords(
  payloadInstance: typeof payload,
  supabaseUserId: string,
  data: ClinicStaffRegistrationData,
) {
  // Create BasicUser record first
  const basicUserData = {
    email: data.email,
    supabaseUserId,
    userType: 'clinic' as const,
  }

  const basicUserRecord = await payloadInstance.create({
    collection: 'basicUsers',
    data: basicUserData,
  })

  // Create ClinicStaff profile record with pending status
  const clinicStaffData = {
    user: basicUserRecord.id,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    status: 'pending' as const,
  }

  const clinicStaffRecord = await payloadInstance.create({
    collection: 'clinicStaff',
    data: clinicStaffData,
  })

  return { basicUserRecord, clinicStaffRecord }
}
