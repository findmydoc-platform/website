import { describe, expect, it } from 'vitest'

import { resolvePasswordResetLoginTarget } from '@/auth/utilities/loginRedirects'

describe('resolvePasswordResetLoginTarget', () => {
  it.each([
    ['patient', '/login/patient'],
    ['clinic', '/admin/login'],
    ['platform', '/admin/login'],
    ['staff', '/admin/login'],
    ['unknown', '/login/patient'],
    [undefined, '/login/patient'],
  ] as const)('maps %s recovery users to %s', (userType, href) => {
    expect(resolvePasswordResetLoginTarget(userType)).toEqual({ href })
  })
})
