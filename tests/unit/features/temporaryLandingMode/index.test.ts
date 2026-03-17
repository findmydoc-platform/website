import { describe, expect, it } from 'vitest'

import {
  isTemporaryLandingModeEnabled,
  isTemporaryLandingModeExemptPath,
  isTemporaryLandingModeRequest,
  isTemporaryLandingRootPath,
  TEMPORARY_LANDING_MODE_REQUEST_HEADER,
} from '@/features/temporaryLandingMode'

describe('temporaryLandingMode feature', () => {
  it('enables landing mode for truthy env values', () => {
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: 'true' })).toBe(true)
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: 'TRUE' })).toBe(true)
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: '1' })).toBe(true)
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: 'yes' })).toBe(true)
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: 'on' })).toBe(true)
  })

  it('disables landing mode for missing or false-like values', () => {
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: undefined })).toBe(false)
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: '' })).toBe(false)
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: 'false' })).toBe(false)
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: '0' })).toBe(false)
    expect(isTemporaryLandingModeEnabled({ TEMPORARY_LANDING_MODE_ENABLED: 'off' })).toBe(false)
  })

  it('recognizes temporary landing exempt paths', () => {
    expect(isTemporaryLandingModeExemptPath('/admin/login')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/admin/first-admin/')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/privacy-policy')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/imprint')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/contact')).toBe(true)
    expect(isTemporaryLandingModeExemptPath('/posts')).toBe(false)
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
