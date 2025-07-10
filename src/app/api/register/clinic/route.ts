import {
  createClinicRegistrationRecords,
  createClinicStaffUserConfig,
  type ClinicRegistrationData,
} from '@/auth/utilities/registration'
import { baseRegistrationHandler } from '@/auth/utilities/baseRegistrationHandler'

export async function POST(request: Request) {
  return baseRegistrationHandler<ClinicRegistrationData>(request, {
    createUserConfig: createClinicStaffUserConfig,
    createPayloadRecords: createClinicRegistrationRecords,
    successMessage:
      'Clinic submitted successfully. Your staff account is pending approval.',
    errorContext: 'clinic registration',
  })
}
