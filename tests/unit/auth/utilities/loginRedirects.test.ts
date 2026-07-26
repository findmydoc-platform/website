import { describe, expect, it } from 'vitest'

import { resolvePasswordResetLoginTarget } from '@/auth/utilities/loginRedirects'

describe('resolvePasswordResetLoginTarget', () => {
  const clinicLoginHref = 'https://clinics.example.com/login'

  it.each([
    ['patient', undefined, '/login/patient'],
    ['clinic', clinicLoginHref, clinicLoginHref],
    ['platform', undefined, '/admin/login'],
    ['staff', undefined, '/admin/login'],
    ['unknown', undefined, '/login/patient'],
    [undefined, undefined, '/login/patient'],
  ] as const)('maps %s recovery users with clinic target %s to %s', (userType, configuredClinicLoginHref, href) => {
    expect(resolvePasswordResetLoginTarget(userType, configuredClinicLoginHref)).toEqual({ href })
  })

  it('requires the Dashboard target only for clinic recovery users', () => {
    expect(() => resolvePasswordResetLoginTarget('clinic')).toThrow(
      'Clinic dashboard login target is required for clinic users',
    )
  })
})
