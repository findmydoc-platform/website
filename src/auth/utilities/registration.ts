import { createAdminClient } from './supaBaseServer'
import type { Payload } from 'payload'

// Registration data types
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

export interface ClinicRegistrationData extends BaseRegistrationData {
  clinicName: string
  street: string
  houseNumber: string
  zipCode: string
  city: string
  phoneNumber: string
}

// Supabase user creation configuration
export interface SupabaseUserConfig {
  email: string
  password: string
  user_metadata: Record<string, any>
  app_metadata: Record<string, any>
  email_confirm: boolean
}

// Create a Supabase user with common error handling
export async function createSupabaseUser(config: SupabaseUserConfig) {
  const supabase = await createAdminClient()

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

//patient, clinic, platform
export function createSupabaseUserConfig(
  data: BaseRegistrationData,
  userType: string,
): SupabaseUserConfig {
  if (!['patient', 'clinic', 'platform'].includes(userType)) {
    throw new Error(
      `Invalid user type: ${userType}. Must be one of 'patient', 'clinic', or 'platform'.`,
    )
  }

  return {
    email: data.email,
    password: data.password,
    user_metadata: {
      first_name: data.firstName,
      last_name: data.lastName,
    },
    app_metadata: {
      user_type: userType,
    },
    email_confirm: true,
  }
}

// Create a patient record in PayloadCMS
export async function createPatientRecord(
  payloadInstance: Payload,
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
    overrideAccess: true, // Bypass access controls for server-side registration
  })
}

// Create first clinic and owner records during clinic registration
export async function createClinicStaffRecords(
  payloadInstance: Payload,
  supabaseUserId: string,
  data: BaseRegistrationData,
) {
  // Create BasicUser record first using local API with overrides to bypass access controls
  const basicUserData = {
    email: data.email,
    supabaseUserId,
    userType: 'clinic' as const,
  }

  const basicUserRecord = await payloadInstance.create({
    collection: 'basicUsers',
    data: basicUserData,
    overrideAccess: true,
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
    overrideAccess: true,
  })

  return { basicUserRecord, clinicStaffRecord }
}

// Validate that no platform users exist (for first admin creation)
export async function validateFirstAdminCreation(): Promise<string | null> {
  const supabase = await createAdminClient()

  const { data: existingUsers, error: fetchError } = await supabase.auth.admin.listUsers()
  if (fetchError) {
    throw new Error(`Failed to verify first user status: ${fetchError.message}`)
  }

  const platformUsers =
    existingUsers?.users?.filter((user) => user.app_metadata?.user_type === 'platform') || []

  if (platformUsers.length > 0) {
    return 'At least one Admin user already exists'
  }

  return null
}
