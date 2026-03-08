type RuntimeEnv = NodeJS.ProcessEnv | Record<string, string | undefined>

export type StorageRuntimeMode = 'local' | 'cloud'

export type S3RuntimeConfig = {
  accessKeyId: string
  bucket: string
  endpoint: string
  forcePathStyle: boolean
  region: string
  secretAccessKey: string
}

const isEnabled = (value: string | undefined): boolean => value === 'true'

export function shouldUseCloudStorage(env: RuntimeEnv = process.env): boolean {
  const nodeEnv = env.NODE_ENV

  if (nodeEnv === 'production') return true
  if (nodeEnv === 'development') return isEnabled(env.USE_S3_IN_DEV)
  if (nodeEnv === 'test') return isEnabled(env.USE_S3_IN_TEST)

  return false
}

export function resolveStorageRuntimeMode(env: RuntimeEnv = process.env): StorageRuntimeMode {
  return shouldUseCloudStorage(env) ? 'cloud' : 'local'
}

export function readS3RuntimeConfig(env: RuntimeEnv = process.env): S3RuntimeConfig {
  return {
    accessKeyId: env.S3_ACCESS_KEY_ID?.trim() ?? '',
    bucket: env.S3_BUCKET?.trim() ?? '',
    endpoint: env.S3_ENDPOINT?.trim() ?? '',
    forcePathStyle: env.S3_FORCE_PATH_STYLE?.trim() !== 'false',
    region: env.S3_REGION?.trim() ?? '',
    secretAccessKey: env.S3_SECRET_ACCESS_KEY?.trim() ?? '',
  }
}

export function assertS3RuntimeConfig(env: RuntimeEnv = process.env): S3RuntimeConfig {
  const config = readS3RuntimeConfig(env)
  const missing = Object.entries(config)
    .filter(([key, value]) => key !== 'forcePathStyle' && typeof value === 'string' && value.length === 0)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(
      `Cloud storage is enabled but missing required S3 env vars: ${missing.join(', ')}. ` +
        'Provide S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, S3_BUCKET, and S3_ENDPOINT.',
    )
  }

  return config
}

export function getStorageRuntime(env: RuntimeEnv = process.env): {
  mode: StorageRuntimeMode
  s3: S3RuntimeConfig | null
  useCloudStorage: boolean
} {
  const mode = resolveStorageRuntimeMode(env)
  const useCloudStorage = mode === 'cloud'

  return {
    mode,
    s3: useCloudStorage ? assertS3RuntimeConfig(env) : null,
    useCloudStorage,
  }
}
