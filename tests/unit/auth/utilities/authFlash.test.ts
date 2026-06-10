// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import {
  AUTH_FLASH_STORAGE_KEY,
  consumeAuthFlash,
  createPasswordResetCompleteFlash,
  getAuthFlashMessage,
  writeAuthFlash,
} from '@/auth/utilities/authFlash'

describe('authFlash', () => {
  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('writes and consumes a matching password reset flash once', () => {
    const payload = createPasswordResetCompleteFlash(1000)

    writeAuthFlash(payload)

    expect(consumeAuthFlash(2000)).toEqual(payload)
    expect(consumeAuthFlash(2000)).toBeNull()
    expect(window.sessionStorage.getItem(AUTH_FLASH_STORAGE_KEY)).toBeNull()
  })

  it('removes expired or malformed flash payloads', () => {
    writeAuthFlash(createPasswordResetCompleteFlash(1000))

    expect(consumeAuthFlash(1000 + 5 * 60 * 1000 + 1)).toBeNull()
    expect(window.sessionStorage.getItem(AUTH_FLASH_STORAGE_KEY)).toBeNull()

    window.sessionStorage.setItem(AUTH_FLASH_STORAGE_KEY, '{not-json')

    expect(consumeAuthFlash(2000)).toBeNull()
    expect(window.sessionStorage.getItem(AUTH_FLASH_STORAGE_KEY)).toBeNull()
  })

  it('returns the user-facing password reset complete message', () => {
    expect(getAuthFlashMessage(createPasswordResetCompleteFlash())).toBe(
      'Password updated successfully. Sign in with your new password.',
    )
  })
})
