export type AdminSessionCredentials = {
  email: string
  password: string
}

export const ADMIN_SESSION_PERSONAS = ['admin', 'clinic'] as const

export type AdminSessionPersona = (typeof ADMIN_SESSION_PERSONAS)[number]

const REQUIRED_SHARED_AUTH_ENV_VARS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const

const PERSONA_AUTH_ENV_VARS: Record<
  AdminSessionPersona,
  {
    accessMessage: string
    email: 'E2E_ADMIN_EMAIL' | 'E2E_CLINIC_EMAIL'
    password: 'E2E_ADMIN_PASSWORD' | 'E2E_CLINIC_PASSWORD' // pragma: allowlist secret
  }
> = {
  admin: {
    accessMessage:
      'The admin smoke lane expects an existing Supabase platform admin account and does not provision or clean up users automatically.',
    email: 'E2E_ADMIN_EMAIL',
    password: 'E2E_ADMIN_PASSWORD', // pragma: allowlist secret
  },
  clinic: {
    accessMessage:
      'The clinic regression lane expects an existing Supabase clinic staff account and does not provision or clean up auth users automatically.',
    email: 'E2E_CLINIC_EMAIL',
    password: 'E2E_CLINIC_PASSWORD', // pragma: allowlist secret
  },
}

const getRequiredAuthEnvVarNames = (persona: AdminSessionPersona) =>
  [
    PERSONA_AUTH_ENV_VARS[persona].email,
    PERSONA_AUTH_ENV_VARS[persona].password,
    ...REQUIRED_SHARED_AUTH_ENV_VARS,
  ] as const

const readRequiredEnv = (name: string, accessMessage: string): string => {
  const value = process.env[name]

  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required E2E auth environment variable: ${name}. ${accessMessage} Set the fixed credentials in your shell, CI environment, or .env/.env.local before running the Playwright suite.`,
    )
  }

  return value.trim()
}

const ensureAuthEnvironment = (persona: AdminSessionPersona) => {
  const accessMessage = PERSONA_AUTH_ENV_VARS[persona].accessMessage
  const missing = getRequiredAuthEnvVarNames(persona).filter((name) => {
    const value = process.env[name]
    return !value || value.trim().length === 0
  })

  if (missing.length > 0) {
    throw new Error(
      `Missing required E2E auth environment variables: ${missing.join(', ')}. ${accessMessage} Provide them via your shell, CI environment, or .env/.env.local before running Playwright E2E tests.`,
    )
  }
}

export const readSessionCredentialsFromEnv = (persona: AdminSessionPersona): AdminSessionCredentials => {
  const personaConfig = PERSONA_AUTH_ENV_VARS[persona]
  ensureAuthEnvironment(persona)

  return {
    email: readRequiredEnv(personaConfig.email, personaConfig.accessMessage),
    password: readRequiredEnv(personaConfig.password, personaConfig.accessMessage),
  }
}

export const readAdminCredentialsFromEnv = (): AdminSessionCredentials => readSessionCredentialsFromEnv('admin')

export const readClinicCredentialsFromEnv = (): AdminSessionCredentials => readSessionCredentialsFromEnv('clinic')

export const toFixedSessionAccessError = (persona: AdminSessionPersona, error: unknown): Error => {
  const { accessMessage, email, password } = PERSONA_AUTH_ENV_VARS[persona]
  const originalMessage = error instanceof Error ? error.message : String(error)
  const formattedMessage = `${accessMessage} Confirm that ${email} and ${password} point to a valid account that can access /admin. Original error: ${originalMessage}`

  if (error instanceof Error) {
    return new Error(formattedMessage, { cause: error })
  }

  return new Error(formattedMessage)
}

export const toFixedAdminAccessError = (error: unknown): Error => toFixedSessionAccessError('admin', error)

export const toFixedClinicAccessError = (error: unknown): Error => toFixedSessionAccessError('clinic', error)
