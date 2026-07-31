import { resolveServerRuntimeEnvironment } from '@/features/runtimePolicy'

type StorageEnvironmentInput = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | 'DEPLOYMENT_ENV'
    | 'NODE_ENV'
    | 'S3_ACCESS_KEY_ID'
    | 'S3_BUCKET'
    | 'S3_ENDPOINT'
    | 'S3_LOCAL_ENDPOINT'
    | 'S3_REGION'
    | 'S3_SECRET_ACCESS_KEY'
    | 'S3_TEST_ENDPOINT'
    | 'VERCEL_ENV'
  >
>

export type S3StorageConfig = {
  bucket: string
  clientConfig: {
    credentials: {
      accessKeyId: string
      secretAccessKey: string
    }
    endpoint: string
    forcePathStyle: true
    region: string
    responseChecksumValidation?: 'WHEN_REQUIRED'
  }
}

const LOCAL_CREDENTIALS = {
  accessKeyId: 's3mock-access-key',
  secretAccessKey: 's3mock-secret-key', // pragma: allowlist secret
}

const LOCAL_REGION = 'us-east-1'
const LOCAL_STORAGE_CONFIG: Record<'development' | 'test', Omit<S3StorageConfig, 'clientConfig'>> = {
  development: { bucket: 'findmydoc-local' },
  test: { bucket: 'findmydoc-test' },
}

const ONLINE_S3_VARIABLES = [
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_BUCKET',
  'S3_REGION',
] as const

function getTrimmedValue(env: StorageEnvironmentInput, variable: keyof StorageEnvironmentInput): string | undefined {
  const value = env[variable]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function resolveStorageRuntime(env: StorageEnvironmentInput): ReturnType<typeof resolveServerRuntimeEnvironment> {
  const runtime = resolveServerRuntimeEnvironment(env)
  const configuredRuntime = getTrimmedValue(env, 'VERCEL_ENV') ?? getTrimmedValue(env, 'DEPLOYMENT_ENV')

  // Runtime policy deliberately treats an unclassified NODE_ENV as development. Storage must not do so for a production process.
  if (
    runtime === 'development' &&
    getTrimmedValue(env, 'NODE_ENV') === 'production' &&
    configuredRuntime !== 'development'
  ) {
    return 'production'
  }

  return runtime
}

function requireOnlineS3Config(env: StorageEnvironmentInput, runtime: 'preview' | 'production'): S3StorageConfig {
  const missing = ONLINE_S3_VARIABLES.filter((variable) => !getTrimmedValue(env, variable))

  if (missing.length > 0) {
    throw new Error(`Missing required S3 environment variables for ${runtime}: ${missing.join(', ')}`)
  }

  return {
    bucket: getTrimmedValue(env, 'S3_BUCKET')!,
    clientConfig: {
      credentials: {
        accessKeyId: getTrimmedValue(env, 'S3_ACCESS_KEY_ID')!,
        secretAccessKey: getTrimmedValue(env, 'S3_SECRET_ACCESS_KEY')!,
      },
      endpoint: getTrimmedValue(env, 'S3_ENDPOINT')!,
      forcePathStyle: true,
      region: getTrimmedValue(env, 'S3_REGION')!,
    },
  }
}

function resolveLocalS3Config(env: StorageEnvironmentInput, runtime: 'development' | 'test'): S3StorageConfig {
  const endpointVariable = runtime === 'development' ? 'S3_LOCAL_ENDPOINT' : 'S3_TEST_ENDPOINT'
  const fallbackEndpoint = runtime === 'development' ? 'http://localhost:9090' : 'http://localhost:9091'

  return {
    ...LOCAL_STORAGE_CONFIG[runtime],
    clientConfig: {
      credentials: LOCAL_CREDENTIALS,
      endpoint: getTrimmedValue(env, endpointVariable) ?? fallbackEndpoint,
      forcePathStyle: true,
      region: LOCAL_REGION,
      responseChecksumValidation: 'WHEN_REQUIRED',
    },
  }
}

export function resolveS3StorageConfig(env: StorageEnvironmentInput = process.env): S3StorageConfig {
  const runtime = resolveStorageRuntime(env)

  if (runtime === 'development' || runtime === 'test') {
    return resolveLocalS3Config(env, runtime)
  }

  if (runtime === 'preview' || runtime === 'production') {
    return requireOnlineS3Config(env, runtime)
  }

  throw new Error(`Unsupported storage runtime: ${runtime}`)
}

export function resolveS3StorageBucket(env: StorageEnvironmentInput = process.env): string {
  return resolveS3StorageConfig(env).bucket
}
