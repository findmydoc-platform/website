export type RuntimeClass = 'preview' | 'nonPreview'

export type RuntimeEnvironment = 'production' | 'preview' | 'development' | 'test' | 'unknown'

export type ServerRuntimeEnvInput = {
  DEPLOYMENT_ENV?: string
  NODE_ENV?: string
  VERCEL_ENV?: string
}

export type ClientRuntimeEnvInput = {
  NEXT_PUBLIC_DEPLOYMENT_ENV?: string
  NEXT_PUBLIC_VERCEL_ENV?: string
  NODE_ENV?: string
}

export const normalizeEnvValue = (value: string | undefined): string | null => {
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

const toNodeRuntimeEnvironment = (value: string | null): RuntimeEnvironment => {
  if (value === 'test') return 'test'
  return 'development'
}

const toRuntimeClass = (runtimeEnvironment: RuntimeEnvironment): RuntimeClass => {
  return runtimeEnvironment === 'preview' ? 'preview' : 'nonPreview'
}

export const resolveServerRuntimeEnvironment = (env: ServerRuntimeEnvInput = process.env): RuntimeEnvironment => {
  const runtimeValue = normalizeEnvValue(env.VERCEL_ENV) ?? normalizeEnvValue(env.DEPLOYMENT_ENV)
  const runtimeEnvironment = toRuntimeEnvironment(runtimeValue)
  return runtimeEnvironment === 'unknown'
    ? toNodeRuntimeEnvironment(normalizeEnvValue(env.NODE_ENV))
    : runtimeEnvironment
}

export const resolveClientRuntimeEnvironment = (env: ClientRuntimeEnvInput = process.env): RuntimeEnvironment => {
  const runtimeValue =
    normalizeEnvValue(env.NEXT_PUBLIC_VERCEL_ENV) ?? normalizeEnvValue(env.NEXT_PUBLIC_DEPLOYMENT_ENV)

  const runtimeEnvironment = toRuntimeEnvironment(runtimeValue)
  return runtimeEnvironment === 'unknown'
    ? toNodeRuntimeEnvironment(normalizeEnvValue(env.NODE_ENV))
    : runtimeEnvironment
}

export const resolveRuntimeClass = (env: ServerRuntimeEnvInput = process.env): RuntimeClass => {
  return toRuntimeClass(resolveServerRuntimeEnvironment(env))
}

export const resolveClientRuntimeClass = (env: ClientRuntimeEnvInput = process.env): RuntimeClass => {
  return toRuntimeClass(resolveClientRuntimeEnvironment(env))
}

export const isPreviewRuntime = (env: ServerRuntimeEnvInput = process.env): boolean => {
  return resolveRuntimeClass(env) === 'preview'
}

export const isClientPreviewRuntime = (env: ClientRuntimeEnvInput = process.env): boolean => {
  return resolveClientRuntimeClass(env) === 'preview'
}
