export function applyStorageLiveEnvDefaults(env: NodeJS.ProcessEnv = process.env): void {
  if (env.STORAGE_LIVE_TESTS !== 'true') return

  env.S3_ACCESS_KEY_ID ??= 'minioadmin'
  env.S3_SECRET_ACCESS_KEY ??= 'minioadmin'
  env.S3_REGION ??= 'us-east-1'
  env.S3_BUCKET ??= 'findmydoc-storage-test'
  env.S3_ENDPOINT ??= 'http://127.0.0.1:9000'
  env.PAYLOAD_LOG_LEVEL ??= 'info'
}

applyStorageLiveEnvDefaults()
