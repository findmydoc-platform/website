import { describe, expect, it } from 'vitest'

import { isFindmydocPlatformEmail } from '@/auth/utilities/platformStaffEmailPolicy'

describe('platformStaffEmailPolicy', () => {
  it('allows normalized findmydoc.eu platform email addresses', () => {
    expect(isFindmydocPlatformEmail('admin@findmydoc.eu')).toBe(true)
    expect(isFindmydocPlatformEmail('  Admin@Findmydoc.EU  ')).toBe(true)
  })

  it('blocks external and lookalike domains', () => {
    expect(isFindmydocPlatformEmail('admin@example.com')).toBe(false)
    expect(isFindmydocPlatformEmail('admin@sub.findmydoc.eu')).toBe(false)
    expect(isFindmydocPlatformEmail('admin@findmydoc.eu.evil')).toBe(false)
    expect(isFindmydocPlatformEmail('admin@notfindmydoc.eu')).toBe(false)
  })
})
