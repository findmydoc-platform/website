import type {
  ClinicRegistrationFailure,
  ClinicRegistrationSubmitData,
} from '@/features/clinicRegistration/publicSubmission'

// Keep the existing endpoint response contract out of public wording.
const fieldFailures = new Map<string, ClinicRegistrationFailure>([
  ['Clinic name is required', 'nameRequired'],
  ['Invalid clinicName', 'nameTooLong'],
  ['Invalid clinicWebsite', 'websiteInvalid'],
  ['Contact first name is required', 'firstNameRequired'],
  ['Invalid contactFirstName', 'firstNameTooLong'],
  ['Contact last name is required', 'lastNameRequired'],
  ['Invalid contactLastName', 'lastNameTooLong'],
  ['Invalid contactEmail', 'emailInvalid'],
  ['Invalid contactRole', 'roleInvalid'],
  ['Invalid medicalSpecialties', 'specialtiesInvalid'],
])

export async function submitClinicRegistration(
  formData: ClinicRegistrationSubmitData,
): Promise<ClinicRegistrationFailure | undefined> {
  const response = await fetch('/api/auth/register/clinic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  })
  const body: { success?: unknown; error?: unknown } | null = await response.json().catch(() => null)

  if (response.status === 202 && body?.success === true) return
  if (response.status === 400 && typeof body?.error === 'string') {
    return fieldFailures.get(body.error) ?? 'failed'
  }
  return 'failed'
}
