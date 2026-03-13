import { describe, expect, it } from 'vitest'
import { type User } from '@supabase/supabase-js'

import {
  buildPreviewGuardLoginRedirect,
  isAllowedPreviewUser,
  isNonProductionDeployment,
  isPreviewDeployment,
  isPreviewGuardEnabled,
  isPreviewGuardExemptPath,
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

  it('enables guard only for preview deployments', () => {
    expect(
      isPreviewGuardEnabled({
        DEPLOYMENT_ENV: 'preview',
        VERCEL_ENV: undefined,
        NODE_ENV: 'production',
      }),
    ).toBe(true)

    expect(
      isPreviewGuardEnabled({
        DEPLOYMENT_ENV: 'preview',
        VERCEL_ENV: undefined,
        NODE_ENV: 'production',
      }),
    ).toBe(true)

    expect(
      isPreviewGuardEnabled({
        DEPLOYMENT_ENV: 'production',
        VERCEL_ENV: undefined,
        NODE_ENV: 'production',
      }),
    ).toBe(false)
  })

  it('recognizes preview guard exempt paths', () => {
    expect(isPreviewGuardExemptPath('/admin/login')).toBe(true)
    expect(isPreviewGuardExemptPath('/admin/first-admin/')).toBe(true)
    expect(isPreviewGuardExemptPath('/posts')).toBe(false)
  })

  it('allows only platform users', () => {
    const platformUser = {
      app_metadata: { user_type: 'platform' },
    } as Pick<User, 'app_metadata'>
    const clinicUser = {
      app_metadata: { user_type: 'clinic' },
    } as Pick<User, 'app_metadata'>

    expect(isAllowedPreviewUser(platformUser)).toBe(true)
    expect(isAllowedPreviewUser(clinicUser)).toBe(false)
    expect(isAllowedPreviewUser(null)).toBe(false)
  })

  it('builds preview guard login redirect with message and next path', () => {
    const redirectPath = buildPreviewGuardLoginRedirect(new URL('https://example.com/posts/a?foo=bar'))
    const url = new URL(redirectPath, 'https://example.com')

    expect(url.pathname).toBe(PREVIEW_GUARD_LOGIN_PATH)
    expect(url.searchParams.get('message')).toBe(PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY)
    expect(url.searchParams.get('next')).toBe('/posts/a?foo=bar')
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
})
