type RegistrationFormData = Record<string, string>

type PatientRegistrationFailure =
  'missingCredentials' | 'invalidPayload' | 'requestRejected' | 'temporarilyUnavailable' | 'setupFailed'

export async function submitPatientRegistration(
  formData: RegistrationFormData,
): Promise<PatientRegistrationFailure | undefined> {
  const email = formData.email ?? ''
  const password = formData.password ?? ''
  const { firstName, lastName } = formData

  if (!email || !password) return 'missingCredentials'

  const response = await fetch('/api/auth/register/patient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstName, lastName }),
  })

  if (response.status === 400) return 'invalidPayload'
  if (response.status === 403) return 'requestRejected'
  if (response.status === 503) return 'temporarilyUnavailable'

  const body: { success?: boolean } | null = await response.json().catch(() => null)
  return response.ok && body?.success === true ? undefined : 'setupFailed'
}
