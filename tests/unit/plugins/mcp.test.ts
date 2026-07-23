import { describe, expect, it } from 'vitest'
import { isPlatformStaffMcpUser, mcpReadCollectionSlugs } from '@/plugins/mcp'

describe('MCP principal authorization', () => {
  it('accepts direct platform staff without the removed legacy userType field', () => {
    expect(isPlatformStaffMcpUser({ id: 7, collection: 'platformStaff' })).toBe(true)
  })

  it('rejects every other principal collection', () => {
    expect(isPlatformStaffMcpUser({ id: 7, collection: 'clinicStaff' })).toBe(false)
    expect(isPlatformStaffMcpUser({ id: 7, collection: 'patients' })).toBe(false)
    expect(isPlatformStaffMcpUser({ id: 7, collection: 'unknown' })).toBe(false)
    expect(isPlatformStaffMcpUser(null)).toBe(false)
  })

  it('does not expose the disabled before-and-after gallery', () => {
    expect(mcpReadCollectionSlugs).not.toContain('clinicGalleryEntries')
    expect(mcpReadCollectionSlugs).not.toContain('clinicGalleryMedia')
  })
})
