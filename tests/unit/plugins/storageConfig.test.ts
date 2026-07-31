import { describe, expect, it } from 'vitest'

import { resolveS3StorageBucket, resolveS3StorageConfig } from '@/plugins/storageConfig'

const completeOnlineS3Env = {
  S3_ACCESS_KEY_ID: 'online-access-key',
  S3_BUCKET: 'online-bucket',
  S3_ENDPOINT: 'https://storage.example.com',
  S3_REGION: 'eu-central-1',
  S3_SECRET_ACCESS_KEY: 'online-secret-key', // pragma: allowlist secret
} satisfies Partial<NodeJS.ProcessEnv>

describe('resolveS3StorageConfig', () => {
  it('always uses the local S3Mock configuration in development', () => {
    expect(
      resolveS3StorageConfig({
        DEPLOYMENT_ENV: 'development',
        ...completeOnlineS3Env,
      }),
    ).toEqual({
      bucket: 'findmydoc-local',
      clientConfig: {
        credentials: {
          accessKeyId: 's3mock-access-key',
          secretAccessKey: 's3mock-secret-key', // pragma: allowlist secret
        },
        endpoint: 'http://localhost:9090',
        forcePathStyle: true,
        region: 'us-east-1',
        responseChecksumValidation: 'WHEN_REQUIRED',
      },
    })
  })

  it('allows the Docker development endpoint to override the host default', () => {
    expect(
      resolveS3StorageConfig({
        DEPLOYMENT_ENV: 'development',
        S3_LOCAL_ENDPOINT: 'http://s3mock:9090',
      }).clientConfig.endpoint,
    ).toBe('http://s3mock:9090')
  })

  it('uses explicit development storage during a static production-mode build', () => {
    const config = resolveS3StorageConfig({ DEPLOYMENT_ENV: 'development', NODE_ENV: 'production' })

    expect(config.bucket).toBe('findmydoc-local')
    expect(config.clientConfig.endpoint).toBe('http://localhost:9090')
  })

  it('uses a separate local S3Mock bucket and endpoint in tests', () => {
    const config = resolveS3StorageConfig({ DEPLOYMENT_ENV: 'test' })

    expect(config.bucket).toBe('findmydoc-test')
    expect(config.clientConfig.endpoint).toBe('http://localhost:9091')
    expect(resolveS3StorageBucket({ DEPLOYMENT_ENV: 'test' })).toBe('findmydoc-test')
  })

  it.each(['preview', 'production'] as const)('requires complete S3 configuration in %s', (runtime) => {
    expect(() => resolveS3StorageConfig({ DEPLOYMENT_ENV: runtime })).toThrow(
      `Missing required S3 environment variables for ${runtime}: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION`,
    )
  })

  it('fails closed for an unclassified production Node process', () => {
    expect(() => resolveS3StorageConfig({ NODE_ENV: 'production' })).toThrow(
      'Missing required S3 environment variables for production: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION',
    )
  })

  it.each(['preview', 'production'] as const)('uses real S3 credentials in %s', (runtime) => {
    const config = resolveS3StorageConfig({ DEPLOYMENT_ENV: runtime, ...completeOnlineS3Env })

    expect(config).toEqual({
      bucket: 'online-bucket',
      clientConfig: {
        credentials: {
          accessKeyId: 'online-access-key',
          secretAccessKey: 'online-secret-key', // pragma: allowlist secret
        },
        endpoint: 'https://storage.example.com',
        forcePathStyle: true,
        region: 'eu-central-1',
      },
    })
  })
})
