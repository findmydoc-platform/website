import { describe, expect, it } from 'vitest'

import {
  isTemporaryLandingModeExemptPath,
  isTemporaryLandingModeRequest,
  isTemporaryLandingPublicExemptPath,
  isTemporaryLandingRootPath,
  TEMPORARY_LANDING_MODE_REQUEST_HEADER,
} from '@/features/temporaryLandingMode'

describe('temporaryLandingMode feature', () => {
  it('recognizes temporary landing exempt paths', () => {
    expect(isTemporaryLandingModeExemptPath('/admin')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/admin/login')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/admin/account')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/auth/callback')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/auth/password/reset')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/auth/password/reset/complete')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/auth/invite/complete')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/login/patient')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/logout')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/register/patient')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/register/clinic/')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/privacy-policy')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/imprint')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/contact')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/posts')).toBe(false)
  })

  it('recognizes public temporary landing exempt paths separately', () => {
    expect(isTemporaryLandingPublicExemptPath('/privacy-policy')).toBe(true)
    expect(isTemporaryLandingPublicExemptPath('/imprint')).toBe(true)
    expect(isTemporaryLandingPublicExemptPath('/contact')).toBe(true)
    expect(isTemporaryLandingPublicExemptPath('/admin/login')).toBe(false)
    expect(isTemporaryLandingPublicExemptPath('/login/patient')).toBe(false)
  })

  it('recognizes temporary landing root paths', () => {
    expect(isTemporaryLandingRootPath('/')).toBe(true)
    expect(isTemporaryLandingRootPath('')).toBe(true)
    expect(isTemporaryLandingRootPath('/posts')).toBe(false)
  })

  it('detects temporary landing request header', () => {
    const withHeader = new Headers({ [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1' })
    const withoutHeader = new Headers()

    expect(isTemporaryLandingModeRequest(withHeader)).toBe(true)
    expect(isTemporaryLandingModeRequest(withoutHeader)).toBe(false)
  })
})
