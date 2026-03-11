const runtimeEnvironments = ['production', 'preview', 'development', 'test'] as const
const truthy = new Set(['1', 'true', 'yes', 'on'])
const falsy = new Set(['0', 'false', 'no', 'off'])

export type SeedRuntimeEnv = (typeof runtimeEnvironments)[number]
export type SeedType = 'baseline' | 'demo'

export const isSeedRuntimeEnv = (value: string): value is SeedRuntimeEnv => {
  return (runtimeEnvironments as readonly string[]).includes(value)
}

export const resolveSeedRuntimeEnv = (
  explicit: SeedRuntimeEnv | undefined,
  env: NodeJS.ProcessEnv = process.env,
): SeedRuntimeEnv => {
  if (explicit) return explicit

  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase()
  if (vercelEnv && isSeedRuntimeEnv(vercelEnv)) {
    return vercelEnv
  }

  const nodeEnv = env.NODE_ENV?.trim().toLowerCase()
  if (nodeEnv === 'production' || nodeEnv === 'test' || nodeEnv === 'development') {
    return nodeEnv
  }

  return 'development'
}

export const isProductionRuntime = (env: NodeJS.ProcessEnv = process.env): boolean => {
  return resolveSeedRuntimeEnv(undefined, env) === 'production'
}

export const assertSeedRunPolicy = (options: { runtimeEnv: SeedRuntimeEnv; type: SeedType; reset: boolean }) => {
  if (options.runtimeEnv === 'production' && options.type === 'demo') {
    throw new Error('Demo seeding is disabled in production runtime')
  }

  if (options.runtimeEnv === 'production' && options.reset) {
    throw new Error('Seed reset is disabled in production runtime')
  }
}

const parseBooleanLike = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase()
  if (truthy.has(normalized)) return true
  if (falsy.has(normalized)) return false
  return null
}

export const isSeedEndpointPostEnabled = (
  runtimeEnv: SeedRuntimeEnv,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const override = env.SEED_ENDPOINT_ALLOW_POST
  if (override) {
    const parsed = parseBooleanLike(override)
    if (parsed !== null) return parsed
  }

  return runtimeEnv === 'development' || runtimeEnv === 'test'
}
