export type AdminSessionCredentials = {
  email: string
  password: string
}

const REQUIRED_SHARED_AUTH_ENV_VARS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const

const ADMIN_AUTH_ENV_VARS = {
  accessMessage:
    'The admin smoke lane expects an existing Supabase platform admin account, syncs the Payload test record, and does not provision or clean up auth users automatically.',
  email: 'E2E_ADMIN_EMAIL',
  password: 'E2E_ADMIN_PASSWORD', // pragma: allowlist secret
} as const

const REQUIRED_ADMIN_AUTH_ENV_VARS = [
  ADMIN_AUTH_ENV_VARS.email,
  ADMIN_AUTH_ENV_VARS.password,
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

const ensureAuthEnvironment = () => {
  const missing = REQUIRED_ADMIN_AUTH_ENV_VARS.filter((name) => {
    const value = process.env[name]
    return !value || value.trim().length === 0
  })

  if (missing.length > 0) {
    throw new Error(
      `Missing required E2E auth environment variables: ${missing.join(', ')}. ${ADMIN_AUTH_ENV_VARS.accessMessage} Provide them via your shell, CI environment, or .env/.env.local before running Playwright E2E tests.`,
    )
  }
}

export const readAdminCredentialsFromEnv = (): AdminSessionCredentials => {
  ensureAuthEnvironment()

  return {
    email: readRequiredEnv(ADMIN_AUTH_ENV_VARS.email, ADMIN_AUTH_ENV_VARS.accessMessage),
    password: readRequiredEnv(ADMIN_AUTH_ENV_VARS.password, ADMIN_AUTH_ENV_VARS.accessMessage),
  }
}

export const toFixedAdminAccessError = (error: unknown): Error => {
  const { accessMessage, email, password } = ADMIN_AUTH_ENV_VARS
  const originalMessage = error instanceof Error ? error.message : String(error)
  const formattedMessage = `${accessMessage} Confirm that ${email} and ${password} point to a valid account that can access /admin. Original error: ${originalMessage}`

  if (error instanceof Error) {
    return new Error(formattedMessage, { cause: error })
  }

  return new Error(formattedMessage)
}
