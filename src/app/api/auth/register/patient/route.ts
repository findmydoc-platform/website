import {
  createSupabaseUserConfig,
  createPatientRecord,
  type PatientRegistrationData,
} from '@/auth/utilities/userManagement'
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
