import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'
import { createMcpPlugin, isPlatformStaffMcpUser, mcpReadCollectionSlugs } from '@/plugins/mcp'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

describe('MCP principal authorization', () => {
  it.each([
    ['admin', true],
    ['support', false],
    ['content-manager', false],
  ] as const)('allows key management only for a current administrator: %s', async (role, expected) => {
    const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
    const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')
    const payload = createMockPayload()
    payload.findByID.mockResolvedValue({ id: 7, role })
    const req = createMockReq({ id: 7, collection: 'platformStaff', role }, payload)

    for (const operation of ['create', 'read', 'update', 'delete', 'admin'] as const) {
      expect(await collection?.access?.[operation]?.({ req })).toBe(expected)
    }
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'platformStaff',
        id: 7,
        overrideAccess: true,
        select: { role: true },
        req,
      }),
    )
    const hidden = collection?.admin?.hidden
    expect(typeof hidden).toBe('function')
    if (typeof hidden === 'function')
      expect(hidden({ user: { id: 7, collection: 'platformStaff', role } })).toBe(!expected)
  })

  it.each(['missing', 'unavailable'])('denies management when the current staff record is %s', async (state) => {
    const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
    const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')
    const payload = createMockPayload()
    if (state === 'missing') payload.findByID.mockResolvedValue(null)
    else payload.findByID.mockRejectedValue(new Error('Synthetic lookup failure'))
    const req = createMockReq({ id: 7, collection: 'platformStaff', role: 'admin' }, payload)
    for (const operation of ['create', 'read', 'update', 'delete', 'admin'] as const) {
      expect(await collection?.access?.[operation]?.({ req })).toBe(false)
    }
  })

  it.each(['clinicStaff', 'patients', 'payload-mcp-api-keys', undefined])(
    'rejects key management for principal %s without looking up a platform role',
    async (principal) => {
      const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
      const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')
      const payload = createMockPayload()
      const req = createMockReq(principal ? { id: 7, collection: principal, role: 'admin' } : null, payload)
      for (const operation of ['create', 'read', 'update', 'delete', 'admin'] as const) {
        expect(await collection?.access?.[operation]?.({ req })).toBe(false)
      }
      expect(payload.findByID).not.toHaveBeenCalled()
    },
  )

  it('preserves immutable key ownership', async () => {
    const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
    const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')
    const owner = collection?.fields.find((field) => 'name' in field && field.name === 'user')
    if (!owner || !('access' in owner)) throw new Error('Expected the MCP key owner field')
    const req = createMockReq({ id: 7, collection: 'platformStaff', role: 'admin' })
    expect(await owner.access?.create?.({ req })).toBe(false)
    expect(await owner.access?.update?.({ req })).toBe(false)
  })

  it('denies support access to key management even when the request claims an admin role', async () => {
    const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
    const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')
    const payload = createMockPayload()
    payload.findByID.mockResolvedValue({ id: 7, role: 'support' })
    const req = createMockReq({ id: 7, collection: 'platformStaff', role: 'admin' }, payload)

    for (const operation of ['create', 'read', 'update', 'delete', 'admin'] as const) {
      expect(await collection?.access?.[operation]?.({ req })).toBe(false)
    }
  })

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
