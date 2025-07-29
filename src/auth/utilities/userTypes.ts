// Type definitions for user management
// Moved from userManagement.ts for better organization

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

export interface SupabaseUserConfig {
  email: string
  password: string
  user_metadata: Record<string, any>
  app_metadata: Record<string, any>
  email_confirm: boolean
}

export interface SupabaseUserData {
  email: string
  password: string
  userType: 'patient' | 'clinic' | 'platform'
  metadata: {
    firstName: string
    lastName: string
  }
}

// Discriminated union for different user types
export type UserType = 'patient' | 'clinic' | 'platform'

export interface UserCreationOptions {
  generateTempPassword?: boolean
  autoApprove?: boolean
  overrideAccess?: boolean
}

export interface UserDeletionOptions {
  supabaseUserId?: string
  cascadeDelete?: boolean
}

export interface CreateUserResult {
  supabaseUser: any // TODO: Type this properly with Supabase types
  payloadRecords: PayloadRecords
  tempPassword?: string
}

export interface PayloadRecords {
  patient?: any
  basicUser?: any
  clinicStaff?: any
  platformStaff?: any
}
