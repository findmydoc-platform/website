import { describe, expect, it } from 'vitest'
import { type User } from '@supabase/supabase-js'

import {
  buildPreviewGuardLoginRedirect,
  buildPreviewGuardPatientLoginRedirect,
  isAllowedPreviewPatient,
  isAllowedPreviewUser,
  isNonProductionDeployment,
  isPreviewDeployment,
  isPreviewGuardExemptPath,
  isPreviewGuardPatientPath,
  isPreviewGuardPatientRegistrationApiPath,
  PREVIEW_GUARD_FALLBACK_REDIRECT,
  PREVIEW_GUARD_LOGIN_PATH,
  PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY,
  resolveDeploymentEnvironment,
  sanitizePreviewGuardNextPath,
} from '@/features/previewGuard'

describe('previewGuard feature', () => {
  it('uses VERCEL_ENV with highest priority', () => {
    const resolved = resolveDeploymentEnvironment({
      VERCEL_ENV: 'production',
      DEPLOYMENT_ENV: 'preview',
      NODE_ENV: 'production',
    })

    expect(resolved).toBe('production')
  })

  it('detects preview deployments correctly', () => {
    expect(
      isPreviewDeployment({
        DEPLOYMENT_ENV: 'preview',
        VERCEL_ENV: undefined,
        NODE_ENV: 'production',
      }),
    ).toBe(true)

    expect(
      isPreviewDeployment({
        DEPLOYMENT_ENV: undefined,
        VERCEL_ENV: 'production',
        NODE_ENV: 'production',
      }),
    ).toBe(false)
  })

  it('detects non-production deployments correctly', () => {
    expect(
      isNonProductionDeployment({
        DEPLOYMENT_ENV: 'preview',
        VERCEL_ENV: undefined,
        NODE_ENV: 'production',
      }),
    ).toBe(true)

    expect(
      isNonProductionDeployment({
        DEPLOYMENT_ENV: undefined,
        VERCEL_ENV: 'production',
        NODE_ENV: 'production',
      }),
    ).toBe(false)
  })

  it('recognizes preview guard exempt paths', () => {
    const exemptPaths = [
      '/admin/login',
      '/auth/callback',
      '/auth/confirm',
      '/auth/invite/complete',
      '/auth/password/reset',
      '/auth/password/reset/complete',
      '/login/patient',
      '/logout',
    ]

    for (const path of exemptPaths) {
      expect(isPreviewGuardExemptPath(path)).toBe(true)
      expect(isPreviewGuardExemptPath(`${path}/`)).toBe(true)
    }

    expect(isPreviewGuardExemptPath('/admin/first-admin/')).toBe(false)
    expect(isPreviewGuardExemptPath('/auth/password/reset-help')).toBe(false)
    expect(isPreviewGuardExemptPath('/register/patient')).toBe(false)
    expect(isPreviewGuardExemptPath('/posts')).toBe(false)
  })

  it('keeps platform and patient access roles separate', () => {
    const platformUser = {
      app_metadata: { user_type: 'platform' },
    } as Pick<User, 'app_metadata'>
    const patientUser = {
      app_metadata: { user_type: 'patient' },
    } as Pick<User, 'app_metadata'>
    const clinicUser = {
      app_metadata: { user_type: 'clinic' },
    } as Pick<User, 'app_metadata'>

    expect(isAllowedPreviewUser(platformUser)).toBe(true)
    expect(isAllowedPreviewPatient(platformUser)).toBe(false)
    expect(isAllowedPreviewUser(patientUser)).toBe(false)
    expect(isAllowedPreviewPatient(patientUser)).toBe(true)
    expect(isAllowedPreviewUser(clinicUser)).toBe(false)
    expect(isAllowedPreviewPatient(clinicUser)).toBe(false)
    expect(isAllowedPreviewUser(null)).toBe(false)
    expect(isAllowedPreviewPatient(null)).toBe(false)
  })

  it('returns false for malformed user_type values without throwing', () => {
    const malformedUser = {
      app_metadata: { user_type: 42 },
    } as unknown as Pick<User, 'app_metadata'>

    expect(isAllowedPreviewUser(malformedUser)).toBe(false)
    expect(isAllowedPreviewPatient(malformedUser)).toBe(false)
  })

  it('recognizes only the patient route family', () => {
    expect(isPreviewGuardPatientPath('/patient')).toBe(true)
    expect(isPreviewGuardPatientPath('/patient/')).toBe(true)
    expect(isPreviewGuardPatientPath('/patient/favorites')).toBe(true)
    expect(isPreviewGuardPatientPath('/patients')).toBe(false)
    expect(isPreviewGuardPatientPath('/patient-support')).toBe(false)
  })

  it('recognizes only the patient registration API path', () => {
    expect(isPreviewGuardPatientRegistrationApiPath('/api/auth/register/patient')).toBe(true)
    expect(isPreviewGuardPatientRegistrationApiPath('/api/auth/register/patient/')).toBe(true)
    expect(isPreviewGuardPatientRegistrationApiPath('/api/auth/register/patients')).toBe(false)
    expect(isPreviewGuardPatientRegistrationApiPath('/register/patient')).toBe(false)
  })

  it('builds preview guard login redirect with message and next path', () => {
    const redirectPath = buildPreviewGuardLoginRedirect(new URL('https://example.com/posts/a?foo=bar'))
    const url = new URL(redirectPath, 'https://example.com')

    expect(url.pathname).toBe(PREVIEW_GUARD_LOGIN_PATH)
    expect(url.searchParams.get('message')).toBe(PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY)
    expect(url.searchParams.get('next')).toBe('/posts/a?foo=bar')
  })

  it('builds a patient login redirect with the protected route as next path', () => {
    const redirectPath = buildPreviewGuardPatientLoginRedirect(
      new URL('https://example.com/patient/favorites?from=header'),
    )
    const url = new URL(redirectPath, 'https://example.com')

    expect(url.pathname).toBe('/login/patient')
    expect(url.searchParams.get('next')).toBe('/patient/favorites?from=header')
  })

  it('keeps valid relative redirect paths', () => {
    expect(sanitizePreviewGuardNextPath('/partners/clinics?sort=rating')).toBe('/partners/clinics?sort=rating')
  })

  it('falls back for invalid redirect targets', () => {
    expect(sanitizePreviewGuardNextPath('https://evil.example.com')).toBe(PREVIEW_GUARD_FALLBACK_REDIRECT)
    expect(sanitizePreviewGuardNextPath('//evil.example.com')).toBe(PREVIEW_GUARD_FALLBACK_REDIRECT)
    expect(sanitizePreviewGuardNextPath('/admin/login')).toBe(PREVIEW_GUARD_FALLBACK_REDIRECT)
    expect(sanitizePreviewGuardNextPath('/foo\nbar')).toBe(PREVIEW_GUARD_FALLBACK_REDIRECT)
    expect(sanitizePreviewGuardNextPath(undefined)).toBe(PREVIEW_GUARD_FALLBACK_REDIRECT)
  })

  it('keeps paths that only share the login prefix', () => {
    expect(sanitizePreviewGuardNextPath('/admin/login-help')).toBe('/admin/login-help')
  })
})
