import { describe, expect, it } from 'vitest'

import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'

describe('sanitizeInternalRedirectPath', () => {
  it('allows internal paths with search and hash', () => {
    expect(
      sanitizeInternalRedirectPath({
        nextPath: '/clinics/berlin-health?from=favorites#overview',
      }),
    ).toBe('/clinics/berlin-health?from=favorites#overview')
  })

  it('falls back for external, protocol-relative, control-character, and missing paths', () => {
    const args = {
      fallbackPath: '/fallback',
    }

    expect(sanitizeInternalRedirectPath({ ...args, nextPath: 'https://evil.example.com' })).toBe('/fallback')
    expect(sanitizeInternalRedirectPath({ ...args, nextPath: '//evil.example.com' })).toBe('/fallback')
    expect(sanitizeInternalRedirectPath({ ...args, nextPath: '/foo\nbar' })).toBe('/fallback')
    expect(sanitizeInternalRedirectPath({ ...args, nextPath: '/foo\tbar' })).toBe('/fallback')
    expect(sanitizeInternalRedirectPath({ ...args, nextPath: '/foo\u0000bar' })).toBe('/fallback')
    expect(sanitizeInternalRedirectPath({ ...args, nextPath: undefined })).toBe('/fallback')
  })

  it('falls back for blocked paths', () => {
    expect(
      sanitizeInternalRedirectPath({
        nextPath: '/login/patient?next=/patient/favorites',
        fallbackPath: '/',
        blockedPaths: ['/login/patient'],
      }),
    ).toBe('/')
    expect(
      sanitizeInternalRedirectPath({
        nextPath: '/login/patient/#return',
        fallbackPath: '/',
        blockedPaths: ['/login/patient'],
      }),
    ).toBe('/')
  })

  it('keeps root blocked when blockedPaths includes slash', () => {
    expect(
      sanitizeInternalRedirectPath({
        nextPath: '/',
        fallbackPath: '/fallback',
        blockedPaths: ['/'],
      }),
    ).toBe('/fallback')
  })
})
