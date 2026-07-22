import { describe, expect, it } from 'vitest'
import { resolveDashboardUserType } from '@/components/organisms/DeveloperDashboard/userType'

describe('Developer dashboard principal mapping', () => {
  it('maps direct auth collections to dashboard user types', () => {
    expect(resolveDashboardUserType({ collection: 'platformStaff' })).toBe('platform')
    expect(resolveDashboardUserType({ collection: 'clinicStaff' })).toBe('clinic')
    expect(resolveDashboardUserType({ collection: 'patients' })).toBe('patient')
  })

  it('rejects unknown principal shapes', () => {
    expect(resolveDashboardUserType({ collection: 'unknown' })).toBe('unknown')
    expect(resolveDashboardUserType(null)).toBe('unknown')
  })
})
