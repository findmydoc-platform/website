import { createClient } from '@/auth/utilities/supaBaseClient'

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

export async function submitClinicRegistration(formData: RegistrationFormData): Promise<void> {
  const { body, response } = await postJson<SuccessResponse>('/api/auth/register/clinic', formData)

  if (!response.ok) {
    throw new Error(body?.error || 'Clinic registration failed')
  }
}

export async function submitFirstAdminRegistration(formData: RegistrationFormData): Promise<void> {
  const { body, response } = await postJson<SuccessResponse>('/api/auth/register/first-admin', formData)

  if (!response.ok) {
    throw new Error(body?.error || 'First admin registration failed')
  }
}

export async function submitPatientRegistration(formData: RegistrationFormData): Promise<void> {
  const supabase = createClient()

  const email = formData.email ?? ''
  const password = formData.password ?? ''
  const { firstName, lastName } = formData

  if (!email || !password) {
    throw new Error('Email and password are required')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  })

  if (error) {
    throw new Error('Registration failed')
  }

  if (!data.user) {
    throw new Error('Supabase did not return a user id')
  }

  const supabaseUserId = data.user.id
  const { body: metadataBody, response: metadataResponse } = await postJson<SuccessResponse>(
    '/api/auth/register/patient/metadata',
    {
      email,
      userId: supabaseUserId,
    },
  )

  if (!metadataResponse.ok || metadataBody?.success !== true) {
    // Roll back a partially created Supabase account so the user can retry cleanly.
    try {
      await postJson<SuccessResponse>('/api/auth/register/patient/cleanup', {
        email,
        userId: supabaseUserId,
      })
    } catch {}

    throw new Error(
      metadataBody?.error || 'We could not finish setting up your account. Please try again in a few minutes.',
    )
  }
}
