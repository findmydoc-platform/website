import type { RuntimeClass, RuntimeEnvironment } from './core'
export type { ClientRuntimeEnvInput, RuntimeClass, RuntimeEnvironment, ServerRuntimeEnvInput } from './core'
export {
  isClientPreviewRuntime,
  isPreviewRuntime,
  resolveClientRuntimeClass,
  resolveClientRuntimeEnvironment,
  resolveRuntimeClass,
  resolveServerRuntimeEnvironment,
} from './core'

export type SeedRuntimeEnvironment = Exclude<RuntimeEnvironment, 'unknown'>

type RuntimeLevel = 'info' | 'warn'

type RuntimePolicy = {
  logging: {
    defaultLevel: RuntimeLevel
    usePrettyInDevelopment: boolean
  }
}

export type SeedRuntimePolicy = {
  allowBaseline: boolean
  allowDemo: boolean
  allowEndpointPost: boolean
  allowReset: boolean
}

export const RUNTIME_POLICY: Record<RuntimeClass, RuntimePolicy> = {
  preview: {
    logging: {
      defaultLevel: 'info',
      usePrettyInDevelopment: true,
    },
  },
  nonPreview: {
    logging: {
      defaultLevel: 'warn',
      usePrettyInDevelopment: true,
    },
  },
}

const SEED_RUNTIME_POLICY: Record<SeedRuntimeEnvironment, SeedRuntimePolicy> = {
  preview: {
    allowBaseline: true,
    allowDemo: true,
    allowEndpointPost: true,
    allowReset: true,
  },
  development: {
    allowBaseline: true,
    allowDemo: true,
    allowEndpointPost: true,
    allowReset: true,
  },
  test: {
    allowBaseline: true,
    allowDemo: true,
    allowEndpointPost: true,
    allowReset: true,
  },
  production: {
    allowBaseline: true,
    allowDemo: false,
    allowEndpointPost: true,
    allowReset: false,
  },
}

export const resolveSeedRuntimePolicy = (runtimeEnvironment: SeedRuntimeEnvironment): SeedRuntimePolicy => {
  return SEED_RUNTIME_POLICY[runtimeEnvironment]
}
