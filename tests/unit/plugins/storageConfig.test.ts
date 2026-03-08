import { describe, expect, it } from 'vitest'

import { hasCloudStorageConfig, shouldUseCloudStorage } from '@/plugins/storageConfig'

const completeS3Env = {
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'example-value', // pragma: allowlist secret
  S3_REGION: 'region',
  S3_ENDPOINT: 'https://storage.example.com',
} satisfies Partial<NodeJS.ProcessEnv>

describe('storageConfig', () => {
  it('detects a complete cloud storage configuration', () => {
    expect(hasCloudStorageConfig(completeS3Env)).toBe(true)
    expect(hasCloudStorageConfig({ S3_BUCKET: 'bucket' })).toBe(false)
  })

  it('always enables cloud storage in production', () => {
    expect(shouldUseCloudStorage({ NODE_ENV: 'production' })).toBe(true)
  })

  it('falls back to local storage for GitHub Actions static builds without S3 config', () => {
    expect(shouldUseCloudStorage({ GITHUB_ACTIONS: 'true', NODE_ENV: 'production' })).toBe(false)
  })

  it('allows explicit opt-in and opt-out in development', () => {
    expect(shouldUseCloudStorage({ NODE_ENV: 'development', USE_S3_IN_DEV: 'true' })).toBe(true)
    expect(
      shouldUseCloudStorage({
        NODE_ENV: 'development',
        USE_S3_IN_DEV: 'false',
        ...completeS3Env,
      }),
    ).toBe(false)
  })

  it('keeps cloud storage disabled outside production without explicit opt-in', () => {
    expect(shouldUseCloudStorage({ NODE_ENV: 'test', ...completeS3Env })).toBe(false)
    expect(shouldUseCloudStorage({ NODE_ENV: 'development', ...completeS3Env })).toBe(false)
    expect(shouldUseCloudStorage({ NODE_ENV: 'development' })).toBe(false)
  })
})
