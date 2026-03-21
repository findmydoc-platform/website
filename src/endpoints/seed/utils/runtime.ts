import { resolveSeedRuntimePolicy, resolveServerRuntimeEnvironment } from '@/features/runtimePolicy'

const runtimeEnvironments = ['production', 'preview', 'development', 'test'] as const

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

  const runtimeEnv = resolveServerRuntimeEnvironment(env)
  if (isSeedRuntimeEnv(runtimeEnv)) {
    return runtimeEnv
  }

  return 'development'
}

export const isProductionRuntime = (env: NodeJS.ProcessEnv = process.env): boolean => {
  return resolveSeedRuntimeEnv(undefined, env) === 'production'
}

export const assertSeedRunPolicy = (options: { runtimeEnv: SeedRuntimeEnv; type: SeedType; reset: boolean }) => {
  const policy = resolveSeedRuntimePolicy(options.runtimeEnv)

  if (options.type === 'baseline' && !policy.allowBaseline) {
    throw new Error('Baseline seeding is disabled in this runtime')
  }

  if (options.type === 'demo' && !policy.allowDemo) {
    throw new Error('Demo seeding is disabled in production runtime')
  }

  if (options.reset && !policy.allowReset) {
    throw new Error('Seed reset is disabled in this runtime')
  }
}

export const isSeedEndpointPostEnabled = (runtimeEnv: SeedRuntimeEnv): boolean => {
  return resolveSeedRuntimePolicy(runtimeEnv).allowEndpointPost
}
