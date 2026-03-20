export type RuntimeClass = 'preview' | 'nonPreview'

export type RuntimeEnvironment = 'production' | 'preview' | 'development' | 'test' | 'unknown'

export type SeedRuntimeEnvironment = Exclude<RuntimeEnvironment, 'unknown'>

type RuntimeLevel = 'info' | 'warn'

type ServerRuntimeEnvInput = {
  DEPLOYMENT_ENV?: string
  NODE_ENV?: string
  VERCEL_ENV?: string
}

type ClientRuntimeEnvInput = {
  NEXT_PUBLIC_DEPLOYMENT_ENV?: string
  NEXT_PUBLIC_VERCEL_ENV?: string
  NODE_ENV?: string
}

type RuntimePolicy = {
  auth: {
    allowPlatformEmailReconcile: boolean
    enablePreviewGuard: boolean
  }
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

const normalizeEnvValue = (value: string | undefined): string | null => {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

const toRuntimeEnvironment = (value: string | null): RuntimeEnvironment => {
  if (!value) return 'unknown'
  if (value === 'preview') return 'preview'
  if (value === 'production') return 'production'
  if (value === 'development') return 'development'
  if (value === 'test') return 'test'
  return 'unknown'
}

const toRuntimeClass = (runtimeEnvironment: RuntimeEnvironment): RuntimeClass => {
  return runtimeEnvironment === 'preview' ? 'preview' : 'nonPreview'
}

export const RUNTIME_POLICY: Record<RuntimeClass, RuntimePolicy> = {
  preview: {
    auth: {
      allowPlatformEmailReconcile: true,
      enablePreviewGuard: true,
    },
    logging: {
      defaultLevel: 'info',
      usePrettyInDevelopment: true,
    },
  },
  nonPreview: {
    auth: {
      allowPlatformEmailReconcile: false,
      enablePreviewGuard: false,
    },
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

export const resolveServerRuntimeEnvironment = (env: ServerRuntimeEnvInput = process.env): RuntimeEnvironment => {
  const runtimeValue =
    normalizeEnvValue(env.VERCEL_ENV) ?? normalizeEnvValue(env.DEPLOYMENT_ENV) ?? normalizeEnvValue(env.NODE_ENV)

  const runtimeEnvironment = toRuntimeEnvironment(runtimeValue)
  return runtimeEnvironment === 'unknown' ? 'development' : runtimeEnvironment
}

export const resolveClientRuntimeEnvironment = (env: ClientRuntimeEnvInput = process.env): RuntimeEnvironment => {
  const runtimeValue =
    normalizeEnvValue(env.NEXT_PUBLIC_VERCEL_ENV) ??
    normalizeEnvValue(env.NEXT_PUBLIC_DEPLOYMENT_ENV) ??
    normalizeEnvValue(env.NODE_ENV)

  const runtimeEnvironment = toRuntimeEnvironment(runtimeValue)
  return runtimeEnvironment === 'unknown' ? 'development' : runtimeEnvironment
}

export const resolveRuntimeClass = (env: ServerRuntimeEnvInput = process.env): RuntimeClass => {
  return toRuntimeClass(resolveServerRuntimeEnvironment(env))
}

export const resolveClientRuntimeClass = (env: ClientRuntimeEnvInput = process.env): RuntimeClass => {
  return toRuntimeClass(resolveClientRuntimeEnvironment(env))
}

export const resolveSeedRuntimePolicy = (runtimeEnvironment: SeedRuntimeEnvironment): SeedRuntimePolicy => {
  return SEED_RUNTIME_POLICY[runtimeEnvironment]
}
