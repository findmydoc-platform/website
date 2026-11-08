import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'
import { createMcpPlugin, isPlatformStaffMcpUser, mcpReadCollectionSlugs } from '@/plugins/mcp'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

describe('MCP principal authorization', () => {
  it.each([
    ['admin', true],
    ['support', false],
    ['content-manager', false],
  ] as const)('limits Admin visibility and access to administrators: %s', async (role, expected) => {
    const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
    const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')
    const payload = createMockPayload()
    payload.findByID.mockResolvedValue({ id: 7, role })
    const req = createMockReq({ id: 7, collection: 'platformStaff', role }, payload)

    expect(await collection?.access?.admin?.({ req })).toBe(expected)
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
    expect(await collection?.access?.read?.({ req })).toBe(false)
  })

  it.each(['clinicStaff', 'patients', 'payload-mcp-api-keys', undefined])(
    'rejects key reads for principal %s even with a claimed admin role',
    async (principal) => {
      const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
      const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')
      const payload = createMockPayload()
      const req = createMockReq(principal ? { id: 7, collection: principal, role: 'admin' } : null, payload)
      expect(await collection?.access?.read?.({ req })).toBe(false)
    },
  )

  it('denies support access to key management even when the request claims an admin role', async () => {
    const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
    const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')
    const payload = createMockPayload()
    payload.findByID.mockResolvedValue({ id: 7, role: 'support' })
    const req = createMockReq({ id: 7, collection: 'platformStaff', role: 'admin' }, payload)

    expect(await collection?.access?.read?.({ req })).toBe(false)
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

  it('requires an explicit key grant for the clinic trash tool', async () => {
    const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
    const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')
    expect(collection?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: 'payload-mcp-tool',
              fields: expect.arrayContaining([
                expect.objectContaining({ name: 'trashClinic', defaultValue: false }),
                expect.objectContaining({ name: 'trashDoctor', defaultValue: false }),
                expect.objectContaining({ name: 'deleteClinicTreatment', defaultValue: false }),
                expect.objectContaining({ name: 'deleteDoctorTreatment', defaultValue: false }),
                expect.objectContaining({ name: 'deleteDoctorSpecialty', defaultValue: false }),
                expect.objectContaining({ name: 'publishClinicGalleryImage', defaultValue: false }),
                expect.objectContaining({ name: 'uploadClinicGalleryImage', defaultValue: false }),
                expect.objectContaining({ name: 'readClinicGallery', defaultValue: false }),
                expect.objectContaining({ name: 'saveClinicGallery', defaultValue: false }),
                expect.objectContaining({ name: 'uploadDoctorImage', defaultValue: false }),
                expect.objectContaining({ name: 'updateDoctorImage', defaultValue: false }),
                expect.objectContaining({ name: 'deleteDoctorImage', defaultValue: false }),
                expect.objectContaining({ name: 'deleteClinicImage', defaultValue: false }),
                expect.objectContaining({ name: 'createClinicProfile', defaultValue: false }),
              ]),
            }),
          ]),
        }),
      ]),
    )
  })

  it.each(['clinics', 'doctors', 'clinictreatments', 'doctortreatments', 'doctorspecialties'])(
    'offers %s create and update permissions that are disabled by default for each MCP key',
    async (slug) => {
      const config = await createMcpPlugin()({ collections: [] } as unknown as Config)
      const collection = config.collections?.find(({ slug }) => slug === 'payload-mcp-api-keys')

      expect(collection?.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: slug,
                fields: expect.arrayContaining([
                  expect.objectContaining({ name: 'create', defaultValue: false }),
                  expect.objectContaining({ name: 'update', defaultValue: false }),
                ]),
              }),
            ]),
          }),
        ]),
      )
    },
  )
})
