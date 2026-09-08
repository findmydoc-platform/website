import path from 'node:path'
import { config as dotenvConfig } from 'dotenv'

const DEFAULT_E2E_PORT = 3100
export const TEMPORARY_LANDING_E2E_RUNTIME_POLICY = 'temporary-landing'

const E2E_TEST_STORAGE = {
  accessKeyId: 's3mock-access-key',
  bucket: 'findmydoc-test',
  region: 'us-east-1',
  secretAccessKey: 's3mock-secret-key', // pragma: allowlist secret
}

const normalizeBaseUrl = (value) => {
  const url = new URL(value)
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

export function loadLocalAndTestEnv({ cwd = process.cwd() } = {}) {
  dotenvConfig({ path: path.resolve(cwd, '.env.local'), quiet: true })
  dotenvConfig({ path: path.resolve(cwd, '.env'), quiet: true })
  dotenvConfig({ path: path.resolve(cwd, '.env.test'), override: true, quiet: true })

  // Test infrastructure must not inherit a development storage backend from a local env file.
  process.env.DEPLOYMENT_ENV = 'test'
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = 'test'

  if (!process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET_KEY) {
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET_KEY
  }

  return process.env
}

export function resolveE2EPort(env = process.env) {
  const rawPort = env.E2E_PORT ?? String(DEFAULT_E2E_PORT)
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid E2E_PORT value: ${rawPort}`)
  }

  return port
}

export function resolvePlaywrightBaseURL(env = process.env) {
  if (env.PLAYWRIGHT_BASE_URL) {
    return normalizeBaseUrl(env.PLAYWRIGHT_BASE_URL)
  }

  return `http://localhost:${resolveE2EPort(env)}`
}

export function applyE2ERuntimeDefaults(env = process.env) {
  const baseUrl = resolvePlaywrightBaseURL(env)
  const temporaryLandingMode = env.E2E_RUNTIME_POLICY === TEMPORARY_LANDING_E2E_RUNTIME_POLICY

  if (temporaryLandingMode) {
    if (new URL(baseUrl).hostname !== 'localhost') {
      throw new Error('Temporary landing E2E policy requires a localhost base URL.')
    }

    const missingPostHogConfig = [
      'NEXT_PUBLIC_POSTHOG_KEY',
      'NEXT_PUBLIC_POSTHOG_HOST',
      'POSTHOG_FEATURE_FLAGS_SECURE_API_KEY',
    ].filter((name) => !env[name]?.trim())

    if (missingPostHogConfig.length > 0) {
      throw new Error(
        `Temporary landing E2E policy requires PostHog local evaluation: ${missingPostHogConfig.join(', ')}`,
      )
    }

    env.DEPLOYMENT_ENV = 'production'
    env.NEXT_PUBLIC_DEPLOYMENT_ENV = 'production'
    env.VERCEL_ENV = 'production'
    env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    env.S3_ACCESS_KEY_ID = E2E_TEST_STORAGE.accessKeyId
    env.S3_BUCKET = E2E_TEST_STORAGE.bucket
    env.S3_ENDPOINT = env.S3_TEST_ENDPOINT ?? 'http://localhost:9091'
    env.S3_REGION = E2E_TEST_STORAGE.region
    env.S3_SECRET_ACCESS_KEY = E2E_TEST_STORAGE.secretAccessKey
  } else {
    env.DEPLOYMENT_ENV = 'test'
    env.NEXT_PUBLIC_DEPLOYMENT_ENV = 'test'
  }

  env.NEXT_PUBLIC_SERVER_URL = baseUrl
  env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'e2e-anon-key'

  return { baseUrl, port: resolveE2EPort(env) }
}
