import { describe, expect, it } from 'vitest'
import {
  assertS3RuntimeConfig,
  getStorageRuntime,
  hasCompleteS3RuntimeConfig,
  resolveStorageRuntimeMode,
  shouldUseCloudStorage,
} from '@/utilities/storage/runtime'

describe('storage runtime', () => {
  it('defaults to local storage in development without opt-in', () => {
    const env = { NODE_ENV: 'development', USE_S3_IN_DEV: 'false' }

    expect(shouldUseCloudStorage(env)).toBe(false)
    expect(resolveStorageRuntimeMode(env)).toBe('local')
    expect(getStorageRuntime(env)).toEqual({
      mode: 'local',
      s3: null,
      useCloudStorage: false,
    })
  })

  it('allows explicit S3 opt-in for development', () => {
    const env = {
      NODE_ENV: 'development',
      S3_ACCESS_KEY_ID: 'key',
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_REGION: 'us-east-1',
      S3_SECRET_ACCESS_KEY: 'example-value', // pragma: allowlist secret
      USE_S3_IN_DEV: 'true',
    }

    expect(shouldUseCloudStorage(env)).toBe(true)
    expect(resolveStorageRuntimeMode(env)).toBe('cloud')
    expect(getStorageRuntime(env)).toEqual({
      mode: 'cloud',
      s3: {
        accessKeyId: 'key',
        bucket: 'bucket',
        endpoint: 'http://127.0.0.1:9000',
        forcePathStyle: true,
        region: 'us-east-1',
        secretAccessKey: 'example-value',
      },
      useCloudStorage: true,
    })
  })

  it('allows explicit S3 opt-in for tests', () => {
    const env = {
      NODE_ENV: 'test',
      S3_ACCESS_KEY_ID: 'key',
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_REGION: 'us-east-1',
      S3_SECRET_ACCESS_KEY: 'example-value', // pragma: allowlist secret
    }

    expect(shouldUseCloudStorage(env)).toBe(true)
    expect(resolveStorageRuntimeMode(env)).toBe('cloud')
  })

  it('falls back to local storage for GitHub Actions static builds without S3 env', () => {
    const env = {
      GITHUB_ACTIONS: 'true',
      NODE_ENV: 'production',
    }

    expect(hasCompleteS3RuntimeConfig(env)).toBe(false)
    expect(shouldUseCloudStorage(env)).toBe(false)
    expect(getStorageRuntime(env)).toEqual({
      mode: 'local',
      s3: null,
      useCloudStorage: false,
    })
  })

  it('fails fast when cloud storage is enabled without a complete S3 config', () => {
    const env = {
      NODE_ENV: 'production',
      S3_ACCESS_KEY_ID: 'key',
      S3_BUCKET: '',
      S3_ENDPOINT: '',
      S3_REGION: 'us-east-1',
      S3_SECRET_ACCESS_KEY: 'example-value', // pragma: allowlist secret
    }

    expect(() => assertS3RuntimeConfig(env)).toThrow(/missing required S3 env vars/i)
  })

  it('always uses path-style addressing for the current S3-compatible providers', () => {
    const env = {
      NODE_ENV: 'production',
      S3_ACCESS_KEY_ID: 'key',
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'https://storage.example.com',
      S3_REGION: 'eu-central-1',
      S3_SECRET_ACCESS_KEY: 'example-value', // pragma: allowlist secret
    }

    expect(assertS3RuntimeConfig(env).forcePathStyle).toBe(true)
  })

  it('keeps cloud storage enabled on GitHub Actions when a full S3 config is present', () => {
    const env = {
      GITHUB_ACTIONS: 'true',
      NODE_ENV: 'production',
      S3_ACCESS_KEY_ID: 'key',
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'https://storage.example.com',
      S3_REGION: 'eu-central-1',
      S3_SECRET_ACCESS_KEY: 'example-value', // pragma: allowlist secret
    }

    expect(hasCompleteS3RuntimeConfig(env)).toBe(true)
    expect(shouldUseCloudStorage(env)).toBe(true)
    expect(resolveStorageRuntimeMode(env)).toBe('cloud')
  })
})
