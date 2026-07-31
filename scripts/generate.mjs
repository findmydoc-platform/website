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

const generationEnv = {
  ...baseEnv,
  // Keep generated Payload artifacts independent from deployment-only S3 credentials.
  DEPLOYMENT_ENV: 'development',
  NODE_ENV: 'development',
}

run('pnpm', ['payload', 'generate:importmap'], generationEnv)
run('pnpm', ['payload', 'generate:types'], generationEnv)
