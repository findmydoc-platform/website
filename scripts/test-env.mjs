import path from 'node:path'
import { config as dotenvConfig } from 'dotenv'

const DEFAULT_E2E_PORT = 3100

const normalizeBaseUrl = (value) => {
  const url = new URL(value)
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

export function loadLocalAndTestEnv({ cwd = process.cwd() } = {}) {
  dotenvConfig({ path: path.resolve(cwd, '.env.local'), quiet: true })
  dotenvConfig({ path: path.resolve(cwd, '.env'), quiet: true })
  dotenvConfig({ path: path.resolve(cwd, '.env.test'), override: true, quiet: true })

  process.env.DEPLOYMENT_ENV ??= 'test'
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV ??= 'test'

  if (!process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET_KEY) {
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET_KEY
  }

  return process.env
}

export function resolveE2EPort(env = process.env) {
  const rawPort = env.E2E_PORT ?? String(DEFAULT_E2E_PORT)
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid E2E_PORT value: ${rawPort}`)
  }

  return port
}

export function resolvePlaywrightBaseURL(env = process.env) {
  if (env.PLAYWRIGHT_BASE_URL) {
    return normalizeBaseUrl(env.PLAYWRIGHT_BASE_URL)
  }

  return `http://localhost:${resolveE2EPort(env)}`
}

export function applyE2ERuntimeDefaults(env = process.env) {
  const baseUrl = resolvePlaywrightBaseURL(env)

  env.DEPLOYMENT_ENV = 'test'
  env.NEXT_PUBLIC_DEPLOYMENT_ENV = 'test'
  env.NEXT_PUBLIC_SERVER_URL = baseUrl

  return { baseUrl, port: resolveE2EPort(env) }
}
