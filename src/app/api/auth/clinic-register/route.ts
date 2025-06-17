import {
  createClinicStaffUserConfig,
  createClinicStaffRecords,
  type ClinicStaffRegistrationData,
} from '@/utilities/auth/registration'
import { baseRegistrationHandler } from '@/utilities/auth/baseRegistrationHandler'

export async function POST(request: Request) {
  return baseRegistrationHandler<ClinicStaffRegistrationData>(request, {
    createUserConfig: createClinicStaffUserConfig,
    createPayloadRecords: createClinicStaffRecords,
    successMessage:
      'Clinic staff registration successful. Your account is pending approval. Please check your email to confirm your account.',
    errorContext: 'clinic staff',
  })
}
