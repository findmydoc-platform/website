import {
  createClinicStaffUserConfig,
  createClinicStaffRecords,
  type ClinicStaffRegistrationData,
} from '@/auth/utilities/registration'
import { baseRegistrationHandler } from '@/auth/utilities/baseRegistrationHandler'

export async function POST(request: Request) {
  return baseRegistrationHandler<ClinicStaffRegistrationData>(request, {
    createUserConfig: createClinicStaffUserConfig,
    createPayloadRecords: createClinicStaffRecords,
    successMessage: 'Clinic registration successful. Your account is pending approval.',
    errorContext: 'clinic staff',
  })
}
