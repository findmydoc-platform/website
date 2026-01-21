import { spawnSync } from 'node:child_process'

const run = (cmd, args, env) => {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    env,
  })

  if (res.error) throw res.error
  if (typeof res.status === 'number' && res.status !== 0) {
    // Mirror common CLI behavior
    process.exit(res.status)
  }
}

const baseEnv = {
  ...process.env,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --no-deprecation`.trim(),
}

const importMapEnv = {
  ...baseEnv,
  // Force import-map generation to include the cloud-storage plugin components so the
  // resulting file remains stable across environments (local dev vs preview/prod).
  USE_S3_IN_DEV: 'true',
  S3_BUCKET: process.env.S3_BUCKET ?? 'dummy',
  S3_REGION: process.env.S3_REGION ?? 'us-east-1',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? 'dummy',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? 'dummy',
}

run('pnpm', ['payload', 'generate:importmap'], importMapEnv)
run('pnpm', ['payload', 'generate:types'], baseEnv)
