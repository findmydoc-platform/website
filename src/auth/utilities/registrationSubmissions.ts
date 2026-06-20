type RegistrationFormData = Record<string, string>

type JsonRequestResult<T> = {
  body: T | null
  response: Response
}

type SuccessResponse = {
  success?: boolean
  error?: string
}

const postJson = async <T>(url: string, payload: unknown): Promise<JsonRequestResult<T>> => {
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

export async function submitPatientRegistration(formData: RegistrationFormData): Promise<void> {
  const email = formData.email ?? ''
  const password = formData.password ?? ''
  const { firstName, lastName } = formData

  if (!email || !password) {
    throw new Error('Email and password are required')
  }

  const { body, response } = await postJson<SuccessResponse>('/api/auth/register/patient', {
    email,
    password,
    firstName,
    lastName,
  })

  if (!response.ok || body?.success !== true) {
    throw new Error(body?.error || 'We could not finish setting up your account. Please try again in a few minutes.')
  }
}
