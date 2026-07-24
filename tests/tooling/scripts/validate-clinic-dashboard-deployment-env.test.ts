import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  CLINIC_DASHBOARD_ORIGIN_BY_ENVIRONMENT,
  validateClinicDashboardDeploymentEnv,
} from '../../../scripts/validate-clinic-dashboard-deployment-env.mjs'

describe('Clinic Dashboard deployment environment preflight', () => {
  it.each([
    ['preview', CLINIC_DASHBOARD_ORIGIN_BY_ENVIRONMENT.preview],
    ['production', CLINIC_DASHBOARD_ORIGIN_BY_ENVIRONMENT.production],
  ])('accepts the approved %s origin', (environment, origin) => {
    expect(
      validateClinicDashboardDeploymentEnv({
        CLINIC_DASHBOARD_URL: origin,
        VERCEL_ENV: environment,
      }),
    ).toEqual({ environment, status: 'validated' })
  })

  it.each(['preview', 'production'])('rejects a missing URL for %s deployments', (environment) => {
    expect(() => validateClinicDashboardDeploymentEnv({ VERCEL_ENV: environment })).toThrow(
      `CLINIC_DASHBOARD_URL is required for ${environment} deployments.`,
    )
  })

  it.each([
    'http://clinic-dashboard-findmydoc.vercel.app',
    'https://clinic-dashboard-findmydoc.vercel.app/auth/callback',
    'https://clinic-dashboard-findmydoc.vercel.app?source=preview',
    'https://clinic-dashboard-findmydoc.vercel.app#callback',
    'https://user:password@clinic-dashboard-findmydoc.vercel.app',
  ])('rejects a value that is not an exact HTTPS origin', (origin) => {
    expect(() =>
      validateClinicDashboardDeploymentEnv({
        CLINIC_DASHBOARD_URL: origin,
        VERCEL_ENV: 'preview',
      }),
    ).toThrow('CLINIC_DASHBOARD_URL must be an exact HTTPS origin')
  })

  it('rejects a deployment-specific Vercel URL for Preview', () => {
    expect(() =>
      validateClinicDashboardDeploymentEnv({
        CLINIC_DASHBOARD_URL: 'https://clinic-dashboard-a363urnhb-findmydoc.vercel.app',
        VERCEL_ENV: 'preview',
      }),
    ).toThrow('CLINIC_DASHBOARD_URL does not match the approved preview origin.')
  })

  it('rejects the Preview origin for Production', () => {
    expect(() =>
      validateClinicDashboardDeploymentEnv({
        CLINIC_DASHBOARD_URL: CLINIC_DASHBOARD_ORIGIN_BY_ENVIRONMENT.preview,
        VERCEL_ENV: 'production',
      }),
    ).toThrow('CLINIC_DASHBOARD_URL does not match the approved production origin.')
  })

  it('uses VERCEL_ENV before the non-Vercel deployment signal', () => {
    expect(
      validateClinicDashboardDeploymentEnv({
        CLINIC_DASHBOARD_URL: CLINIC_DASHBOARD_ORIGIN_BY_ENVIRONMENT.production,
        DEPLOYMENT_ENV: 'preview',
        VERCEL_ENV: 'production',
      }),
    ).toEqual({ environment: 'production', status: 'validated' })
  })

  it('does not gate local and test commands', () => {
    expect(validateClinicDashboardDeploymentEnv({ NODE_ENV: 'test' })).toEqual({
      environment: 'local',
      status: 'skipped',
    })
  })

  it('runs before migrations and the Next.js build in Vercel deployments', async () => {
    const vercelConfig = JSON.parse(await readFile('vercel.json', 'utf8'))

    expect(vercelConfig.buildCommand).toBe('node scripts/validate-clinic-dashboard-deployment-env.mjs && pnpm run ci')
  })
})
