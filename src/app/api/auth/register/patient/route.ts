import {
  createPatientUserConfig,
  createPatientRecord,
  type PatientRegistrationData,
} from '@/auth/utilities/registration'
import { baseRegistrationHandler } from '@/auth/utilities/baseRegistrationHandler'

export async function POST(request: Request) {
  return baseRegistrationHandler<PatientRegistrationData>(request, {
    createUserConfig: createPatientUserConfig,
    createPayloadRecords: createPatientRecord,
    successMessage: 'Patient user created successfully. You can login now.',
    errorContext: 'patient',
  })
}
