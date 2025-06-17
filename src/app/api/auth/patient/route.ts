import {
  createPatientUserConfig,
  createPatientRecord,
  type PatientRegistrationData,
} from '@/utilities/auth/registration'
import { baseRegistrationHandler } from '@/utilities/auth/baseRegistrationHandler'

export async function POST(request: Request) {
  return baseRegistrationHandler<PatientRegistrationData>(request, {
    createUserConfig: createPatientUserConfig,
    createPayloadRecords: createPatientRecord,
    successMessage: 'Patient user created successfully. Please check your email to confirm your account.',
    errorContext: 'patient',
  })
}
