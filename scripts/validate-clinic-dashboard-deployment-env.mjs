import { pathToFileURL } from 'node:url'

export const CLINIC_DASHBOARD_ORIGIN_BY_ENVIRONMENT = Object.freeze({
  preview: 'https://clinic-dashboard-preview-findmydoc.vercel.app',
  production: 'https://clinics.findmydoc.eu',
})

/** @typedef {Readonly<Record<string, string | undefined>>} DeploymentEnv */

/** @param {DeploymentEnv} env */
const resolveDeploymentEnvironment = (env) => {
  const vercelEnvironment = env.VERCEL_ENV?.trim()
  if (vercelEnvironment) return vercelEnvironment

  return env.DEPLOYMENT_ENV?.trim()
}

const isExactHttpsOrigin = (value) => {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }

  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    url.pathname === '/' &&
    !url.search &&
    !url.hash &&
    url.origin === value
  )
}

/** @param {DeploymentEnv} [env] */
export function validateClinicDashboardDeploymentEnv(env = process.env) {
  const environment = resolveDeploymentEnvironment(env)
  const expectedOrigin = CLINIC_DASHBOARD_ORIGIN_BY_ENVIRONMENT[environment]

  if (!expectedOrigin) {
    return { environment: environment || 'local', status: 'skipped' }
  }

  const configuredOrigin = env.CLINIC_DASHBOARD_URL?.trim()
  if (!configuredOrigin) {
    throw new Error(`CLINIC_DASHBOARD_URL is required for ${environment} deployments.`)
  }
  if (!isExactHttpsOrigin(configuredOrigin)) {
    throw new Error('CLINIC_DASHBOARD_URL must be an exact HTTPS origin without credentials, path, query, or fragment.')
  }
  if (configuredOrigin !== expectedOrigin) {
    throw new Error(`CLINIC_DASHBOARD_URL does not match the approved ${environment} origin.`)
  }

  return { environment, status: 'validated' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = validateClinicDashboardDeploymentEnv()
    if (result.status === 'validated') {
      console.log(`Clinic Dashboard deployment environment validated for ${result.environment}.`)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Clinic Dashboard deployment environment validation failed.')
    process.exitCode = 1
  }
}
