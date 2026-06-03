type ClinicRegistrationFormData = {
  clinicName: string
  clinicWebsite: string
  contactEmail: string
  contactFirstName: string
  contactLastName: string
  contactRole: string
  medicalSpecialties: string[]
}

type SuccessResponse = {
  success?: boolean
  error?: string
}

const postJson = async <T>(url: string, payload: unknown): Promise<{ body: T | null; response: Response }> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = (await response.json().catch(() => null)) as T | null

  return {
    body,
    response,
  }
}

export async function submitClinicRegistration(formData: ClinicRegistrationFormData): Promise<void> {
  const { body, response } = await postJson<SuccessResponse>('/api/auth/register/clinic', formData)

  if (!response.ok) {
    throw new Error(body?.error || 'Clinic registration failed')
  }
}
