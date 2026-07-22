import { afterEach, describe, expect, it } from 'vitest'
import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'

const originalValue = process.env.CLINIC_DASHBOARD_URL

afterEach(() => {
  if (originalValue === undefined) Reflect.deleteProperty(process.env, 'CLINIC_DASHBOARD_URL')
  else process.env.CLINIC_DASHBOARD_URL = originalValue
})

describe('getClinicDashboardOrigin', () => {
  it('normalizes a configured absolute origin', () => {
    process.env.CLINIC_DASHBOARD_URL = 'https://dashboard.example.com/'

    expect(getClinicDashboardOrigin()).toBe('https://dashboard.example.com')
  })

  it.each([
    undefined,
    'dashboard.example.com',
    'ftp://dashboard.example.com',
    'https://dashboard.example.com/path',
    'https://user:password@dashboard.example.com', // pragma: allowlist secret
  ])('rejects an unsafe Dashboard origin: %s', (value) => {
    if (value === undefined) Reflect.deleteProperty(process.env, 'CLINIC_DASHBOARD_URL')
    else process.env.CLINIC_DASHBOARD_URL = value

    expect(() => getClinicDashboardOrigin()).toThrow(/CLINIC_DASHBOARD_URL/)
  })
})
