export type AdminSessionCredentials = {
  email: string
  password: string
}

const REQUIRED_AUTH_ENV_VARS = [
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

const FIXED_ADMIN_REQUIREMENT_MESSAGE =
  'The admin smoke lane expects an existing Supabase platform admin account and does not provision or clean up users automatically.'

const readRequiredEnv = (name: (typeof REQUIRED_AUTH_ENV_VARS)[number]): string => {
  const value = process.env[name]

  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required E2E auth environment variable: ${name}. ${FIXED_ADMIN_REQUIREMENT_MESSAGE} Set the fixed admin credentials in your shell, CI environment, or .env/.env.local before running the Playwright smoke suite.`,
    )
  }

  return value.trim()
}

const ensureAuthEnvironment = () => {
  const missing = REQUIRED_AUTH_ENV_VARS.filter((name) => {
    const value = process.env[name]
    return !value || value.trim().length === 0
  })

  if (missing.length > 0) {
    throw new Error(
      `Missing required E2E auth environment variables: ${missing.join(', ')}. ${FIXED_ADMIN_REQUIREMENT_MESSAGE} Provide them via your shell, CI environment, or .env/.env.local before running Playwright admin smoke tests.`,
    )
  }
}

export const readAdminCredentialsFromEnv = (): AdminSessionCredentials => {
  ensureAuthEnvironment()

  return {
    email: readRequiredEnv('E2E_ADMIN_EMAIL'),
    password: readRequiredEnv('E2E_ADMIN_PASSWORD'),
  }
}

export const toFixedAdminAccessError = (error: unknown): Error => {
  const originalMessage = error instanceof Error ? error.message : String(error)
  const formattedMessage = `${FIXED_ADMIN_REQUIREMENT_MESSAGE} Confirm that E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD point to a valid test admin that can access /admin. Original error: ${originalMessage}`

  if (error instanceof Error) {
    return new Error(formattedMessage, { cause: error })
  }

  return new Error(formattedMessage)
}
