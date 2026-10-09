// CommonJS mirror for tooling that cannot load the TypeScript ESM runtime policy.
// Use a distinct basename so extensionless ./core imports resolve to core.ts in analysis tools.
// Keep behavior aligned with core.ts; next-sitemap and runtime-policy tests cover both paths.
const normalizeEnvValue = (value) => {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

const toRuntimeEnvironment = (value) => {
  if (!value) return 'unknown'
  if (value === 'preview') return 'preview'
  if (value === 'production') return 'production'
  if (value === 'development') return 'development'
  if (value === 'test') return 'test'
  return 'unknown'
}

const toNodeRuntimeEnvironment = (value) => {
  if (value === 'test') return 'test'
  return 'development'
}

const toRuntimeClass = (runtimeEnvironment) => {
  return runtimeEnvironment === 'preview' ? 'preview' : 'nonPreview'
}

const resolveServerRuntimeEnvironment = (env = process.env) => {
  const runtimeValue = normalizeEnvValue(env.VERCEL_ENV) ?? normalizeEnvValue(env.DEPLOYMENT_ENV)
  const runtimeEnvironment = toRuntimeEnvironment(runtimeValue)
  return runtimeEnvironment === 'unknown'
    ? toNodeRuntimeEnvironment(normalizeEnvValue(env.NODE_ENV))
    : runtimeEnvironment
}

const resolveRuntimeClass = (env = process.env) => {
  return toRuntimeClass(resolveServerRuntimeEnvironment(env))
}

const isPreviewRuntime = (env = process.env) => {
  return resolveRuntimeClass(env) === 'preview'
}

module.exports = { isPreviewRuntime }
