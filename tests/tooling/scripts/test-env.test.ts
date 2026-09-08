import { describe, expect, it } from 'vitest'
import { applyE2ERuntimeDefaults, TEMPORARY_LANDING_E2E_RUNTIME_POLICY } from '../../../scripts/test-env.mjs'

const buildTemporaryLandingEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env }
  env.E2E_RUNTIME_POLICY = TEMPORARY_LANDING_E2E_RUNTIME_POLICY
  env.NEXT_PUBLIC_POSTHOG_HOST = 'https://posthog.example.test'
  env.NEXT_PUBLIC_POSTHOG_KEY = 'posthog-test-key'
  env.POSTHOG_FEATURE_FLAGS_SECURE_API_KEY = 'posthog-test-feature-flags-key' // pragma: allowlist secret
  env.S3_TEST_ENDPOINT = 'http://localhost:9091'
  return env
}

describe('E2E runtime defaults', () => {
  it('uses production guard policy with local test storage for the temporary landing regression lane', () => {
    const env = buildTemporaryLandingEnv()

    const result = applyE2ERuntimeDefaults(env)

    expect(result.baseUrl).toBe('http://localhost:3100')
    expect(env).toMatchObject({
      DEPLOYMENT_ENV: 'production',
      NEXT_PUBLIC_DEPLOYMENT_ENV: 'production',
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_VERCEL_ENV: 'production',
      NEXT_PUBLIC_SERVER_URL: 'http://localhost:3100',
      S3_ACCESS_KEY_ID: 's3mock-access-key',
      S3_BUCKET: 'findmydoc-test',
      S3_ENDPOINT: 'http://localhost:9091',
      S3_REGION: 'us-east-1',
      S3_SECRET_ACCESS_KEY: 's3mock-secret-key', // pragma: allowlist secret
    })
  })

  it('overrides inherited Vercel preview values for the temporary landing regression lane', () => {
    const env = buildTemporaryLandingEnv()
    env.VERCEL_ENV = 'preview'
    env.NEXT_PUBLIC_VERCEL_ENV = 'preview'

    applyE2ERuntimeDefaults(env)

    expect(env).toMatchObject({
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_VERCEL_ENV: 'production',
    })
  })

  it('requires PostHog local evaluation for the localhost-only temporary landing target', () => {
    const env = buildTemporaryLandingEnv()
    env.POSTHOG_FEATURE_FLAGS_SECURE_API_KEY = ''

    expect(() => applyE2ERuntimeDefaults(env)).toThrow(
      'Temporary landing E2E policy requires PostHog local evaluation: POSTHOG_FEATURE_FLAGS_SECURE_API_KEY',
    )
  })

  it('rejects a non-local host for the localhost-only temporary landing target', () => {
    const env = buildTemporaryLandingEnv()
    env.PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3100'

    expect(() => applyE2ERuntimeDefaults(env)).toThrow('Temporary landing E2E policy requires a localhost base URL.')
  })
})
