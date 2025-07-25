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

export type ClinicStaffRegistrationData = BaseRegistrationData

export type PlatformStaffRegistrationData = BaseRegistrationData

// Supabase user creation configuration
export interface SupabaseUserConfig {
  email: string
  password: string
  user_metadata: Record<string, any>
  app_metadata: Record<string, any>
  email_confirm: boolean
}

// Get a Supabase admin client for user registration (centralized)
export async function createSupabaseAdminClient() {
  return createAdminClient()
}

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

// Create a Supabase user with common error handling
export async function createSupabaseUser(config: SupabaseUserConfig) {
  const supabase = await createSupabaseAdminClient()

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

// Create Supabase user config for patient registration
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
    email_confirm: true,
  }
}

// Create Supabase user config for clinic staff registration
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
    email_confirm: true,
  }
}

// Create Supabase user config for platform staff registration
export function createPlatformStaffUserConfig(
  data: PlatformStaffRegistrationData,
): SupabaseUserConfig {
  return {
    email: data.email,
    password: data.password,
    user_metadata: {
      first_name: data.firstName,
      last_name: data.lastName,
    },
    app_metadata: {
      user_type: 'platform',
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

// Create basic user and clinic staff records in PayloadCMS
export async function createClinicStaffRecords(
  payloadInstance: Payload,
  supabaseUserId: string,
  data: ClinicStaffRegistrationData,
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
    overrideAccess: true, // Bypass access controls for server-side registration
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
    overrideAccess: true, // Bypass access controls for server-side registration
  })

  return { basicUserRecord, clinicStaffRecord }
}

// Validate that no platform users exist (for first admin creation)
export async function validateFirstAdminCreation(): Promise<string | null> {
  const supabase = await createSupabaseAdminClient()

  const { data: existingUsers, error: fetchError } = await supabase.auth.admin.listUsers()
  if (fetchError) {
    throw new Error(`Failed to verify first user status: ${fetchError.message}`)
  }

  const platformUsers =
    existingUsers?.users?.filter((user) => user.app_metadata?.user_type === 'platform') || []

  if (platformUsers.length > 0) {
    return 'Admin user already exists'
  }

  return null
}

// Delete a Supabase user (with graceful handling of already-deleted users)
export async function deleteSupabaseUser(supabaseUserId: string) {
  const supabase = await createSupabaseAdminClient()

  // First, check if the user exists
  const { data: userData, error: fetchError } =
    await supabase.auth.admin.getUserById(supabaseUserId)

  if (fetchError) {
    // If we can't fetch the user, they might already be deleted
    if (fetchError.message?.includes('User not found') || fetchError.status === 404) {
      console.warn(`Supabase user ${supabaseUserId} was already deleted or doesn't exist`)
      return // Successfully "deleted" (already gone)
    }
    console.error('Error checking Supabase user existence:', fetchError)
    throw new Error(`Failed to verify Supabase user status: ${fetchError.message}`)
  }

  if (!userData.user) {
    console.warn(`Supabase user ${supabaseUserId} was already deleted`)
    return // Successfully "deleted" (already gone)
  }

  // User exists, proceed with deletion
  const { error } = await supabase.auth.admin.deleteUser(supabaseUserId)

  if (error) {
    // Double-check for "already deleted" errors during deletion
    if (error.message?.includes('User not found') || error.status === 404) {
      console.warn(`Supabase user ${supabaseUserId} was deleted during deletion attempt`)
      return // Successfully "deleted" (became deleted between check and deletion)
    }

    console.error('Failed to delete Supabase user:', error)
    throw new Error(`Supabase user deletion failed: ${error.message}`)
  }

  console.log(`Successfully deleted Supabase user ${supabaseUserId}`)
}
