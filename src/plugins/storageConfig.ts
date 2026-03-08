export function hasCloudStorageConfig(env: Partial<NodeJS.ProcessEnv>): boolean {
  return [env.S3_BUCKET, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY, env.S3_REGION, env.S3_ENDPOINT].every(
    (value) => typeof value === 'string' && value.trim().length > 0,
  )
}

export function shouldUseCloudStorage(env: Partial<NodeJS.ProcessEnv>): boolean {
  if (env.NODE_ENV === 'production') {
    return true
  }

  if (env.NODE_ENV !== 'development') {
    return false
  }

  return env.USE_S3_IN_DEV === 'true'
}
