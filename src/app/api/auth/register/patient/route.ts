/**
 * Legacy endpoint: will be removed after Phase 2 migrates Patients to collection hooks.
 * Kept for compatibility with current patient registration.
 */
import {
  createSupabaseUserConfig,
  createPatientRecord,
  type PatientRegistrationData,
} from '@/auth/utilities/registration'
import { baseRegistrationHandler } from '@/auth/utilities/baseRegistrationHandler'

export async function POST(request: Request) {
  return baseRegistrationHandler<PatientRegistrationData>(
    request,
    {
      createUserConfig: createSupabaseUserConfig,
      createPayloadRecords: createPatientRecord,
      successMessage: 'Patient user created successfully. You can login now.',
      errorContext: 'patient',
    },
    'patient',
  )
}
