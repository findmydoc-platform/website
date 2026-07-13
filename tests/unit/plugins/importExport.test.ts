import type { Access, CollectionConfig, Endpoint, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  generatedCollectionAccess,
  managedPluginCollectionSlugs,
  securePlatformManagedPluginCollection,
} from '@/security/generatedCollectionAccess'
import { importExportPluginConfig, importExportTargetSlugs } from '@/plugins/importExport'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

const expectedTargetSlugs = [
  'pages',
  'posts',
  'platformContentMedia',
  'categories',
  'accreditation',
  'medical-specialties',
  'treatments',
  'countries',
  'cities',
  'tags',
  'redirects',
  'forms',
]

const excludedSensitiveSlugs = [
  'basicUsers',
  'patients',
  'clinicStaff',
  'platformStaff',
  'userProfileMedia',
  'clinics',
  'doctors',
  'clinicMedia',
  'clinicGalleryMedia',
  'clinicGalleryEntries',
  'doctorMedia',
  'clinicApplications',
  'patientClinicInquiries',
  'favoriteclinics',
  'reviews',
  'form-submissions',
]

const runAccess = async (access: Access | undefined, user: PayloadRequest['user']) => {
  if (!access) throw new Error('Expected access function')
  return access({ req: createMockReq(user) })
}

const asPayloadUser = (user: unknown): PayloadRequest['user'] => user as PayloadRequest['user']

const makeCollection = (handler: Endpoint['handler']): CollectionConfig => ({
  slug: 'exports',
  access: {
    update: () => true,
  },
  admin: {
    custom: {
      preserved: true,
    },
  },
  endpoints: [
    {
      handler,
      method: 'post',
      path: '/download',
    },
  ],
  fields: [],
})

describe('import and export plugin configuration', () => {
  it('uses the exact fail-closed target allowlist', () => {
    expect(importExportTargetSlugs).toEqual(expectedTargetSlugs)
    expect(importExportPluginConfig.collections.map(({ slug }) => slug)).toEqual(expectedTargetSlugs)

    for (const slug of excludedSensitiveSlugs) {
      expect(importExportTargetSlugs).not.toContain(slug)
    }
  })

  it('registers both generated collections for permission-matrix verification', () => {
    expect(managedPluginCollectionSlugs).toEqual(['imports', 'exports'])
    expect(Object.keys(generatedCollectionAccess)).toEqual(managedPluginCollectionSlugs)
  })

  it.each(['imports', 'exports'] as const)('allows only platform staff to administer %s', async (slug) => {
    const adminAccess = generatedCollectionAccess[slug].admin

    await expect(runAccess(adminAccess, asPayloadUser(mockUsers.platform()))).resolves.toBe(true)
    await expect(runAccess(adminAccess, asPayloadUser(mockUsers.clinic()))).resolves.toBe(false)
    await expect(runAccess(adminAccess, asPayloadUser(mockUsers.patient()))).resolves.toBe(false)
    await expect(runAccess(adminAccess, null)).resolves.toBe(false)
  })

  it('preserves plugin configuration while securing collection operations and custom endpoints', async () => {
    const originalHandler = vi.fn(async () => Response.json({ ok: true }))
    const securedCollection = securePlatformManagedPluginCollection({
      collection: makeCollection(originalHandler),
    })

    expect(securedCollection.admin?.custom).toEqual({ preserved: true })
    expect(await runAccess(securedCollection.access?.update, asPayloadUser(mockUsers.platform()))).toBe(false)

    if (!Array.isArray(securedCollection.endpoints)) throw new Error('Expected secured endpoints')
    const securedHandler = securedCollection.endpoints[0]?.handler
    if (!securedHandler) throw new Error('Expected secured endpoint handler')

    const clinicResponse = await securedHandler(createMockReq(mockUsers.clinic()) as PayloadRequest)
    expect(clinicResponse.status).toBe(403)
    expect(originalHandler).not.toHaveBeenCalled()

    const platformResponse = await securedHandler(createMockReq(mockUsers.platform()) as PayloadRequest)
    expect(platformResponse.status).toBe(200)
    expect(originalHandler).toHaveBeenCalledOnce()
  })
})
