import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import type { File, Payload, PayloadRequest } from 'payload'

import config from '@payload-config'
import type { Export, Import } from '@/payload-types'
import { testSlug } from '../../fixtures/testSlug'
import {
  asPayloadStaffUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
  type PayloadRequestUser,
} from '../../fixtures/testUsers'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

describe('Import and export access integration', () => {
  let payload: Payload
  let platformUser: PayloadRequestUser
  let clinicUser: PayloadRequestUser
  let patientUser: PayloadRequestUser

  const slugPrefix = testSlug('importExport-access.test.ts')
  const createdStaffIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdExportIds: Array<number | string> = []
  const createdImportIds: Array<number | string> = []

  const buildJsonFile = (suffix: string): File => {
    const data = Buffer.from('[]')

    return {
      name: `${slugPrefix}-${suffix}.json`,
      data,
      mimetype: 'application/json',
      size: data.length,
    }
  }

  const createExport = async (user: PayloadRequestUser): Promise<Export> => {
    const created = (await payload.create({
      collection: 'exports',
      data: {
        collectionSlug: 'countries',
        format: 'json',
        name: `${slugPrefix}-countries`,
      },
      depth: 0,
      overrideAccess: false,
      user,
    })) as Export

    createdExportIds.push(created.id)
    return created
  }

  const createImport = async (user: PayloadRequestUser): Promise<Import> => {
    const created = (await payload.create({
      collection: 'imports',
      data: {
        collectionSlug: 'countries',
        importMode: 'create',
        status: 'completed',
      },
      depth: 0,
      file: buildJsonFile('countries'),
      overrideAccess: false,
      user,
    })) as Import

    createdImportIds.push(created.id)
    return created
  }

  beforeAll(async () => {
    payload = await getPayload({ config })

    const platform = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform`,
      createdStaffIds,
    })
    const clinic = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic`,
      createdStaffIds,
    })
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient`,
      createdPatientIds,
    })

    platformUser = asPayloadStaffUser(platform)
    clinicUser = asPayloadStaffUser(clinic)
    patientUser = asPayloadPatientUser(patient)
  })

  afterEach(async () => {
    while (createdImportIds.length) {
      const id = createdImportIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'imports', id, overrideAccess: true })
      } catch {}
    }

    while (createdExportIds.length) {
      const id = createdExportIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'exports', id, overrideAccess: true })
      } catch {}
    }
  })

  afterAll(async () => {
    await cleanupTrackedUsers(payload, {
      staffIds: createdStaffIds,
      patientIds: createdPatientIds,
    })
  })

  it('allows platform staff to create, read, and delete jobs while denying updates', async () => {
    const exportJob = await createExport(platformUser)
    const importJob = await createImport(platformUser)

    const [exportsResult, importsResult] = await Promise.all([
      payload.find({ collection: 'exports', depth: 0, overrideAccess: false, user: platformUser }),
      payload.find({ collection: 'imports', depth: 0, overrideAccess: false, user: platformUser }),
    ])

    expect(exportsResult.docs.some(({ id }) => id === exportJob.id)).toBe(true)
    expect(importsResult.docs.some(({ id }) => id === importJob.id)).toBe(true)

    await expect(
      payload.update({
        collection: 'exports',
        id: exportJob.id,
        data: { name: `${slugPrefix}-updated` },
        overrideAccess: false,
        user: platformUser,
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'imports',
        id: importJob.id,
        data: { status: 'failed' },
        overrideAccess: false,
        user: platformUser,
      }),
    ).rejects.toThrow()

    await payload.delete({ collection: 'exports', id: exportJob.id, overrideAccess: false, user: platformUser })
    await payload.delete({ collection: 'imports', id: importJob.id, overrideAccess: false, user: platformUser })
  })

  it.each([
    ['clinic', (): PayloadRequestUser | undefined => clinicUser],
    ['patient', (): PayloadRequestUser | undefined => patientUser],
    ['anonymous', (): PayloadRequestUser | undefined => undefined],
  ] as const)('denies %s users every import and export operation', async (_label, getUser) => {
    const exportJob = await createExport(platformUser)
    const importJob = await createImport(platformUser)
    const user = getUser()

    for (const collection of ['exports', 'imports'] as const) {
      await expect(
        payload.find({ collection, depth: 0, overrideAccess: false, ...(user ? { user } : {}) }),
      ).rejects.toThrow()
    }

    await expect(
      payload.create({
        collection: 'exports',
        data: { collectionSlug: 'countries', format: 'json', name: `${slugPrefix}-blocked` },
        overrideAccess: false,
        ...(user ? { user } : {}),
      }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'imports',
        data: { collectionSlug: 'countries', importMode: 'create', status: 'completed' },
        file: buildJsonFile('blocked'),
        overrideAccess: false,
        ...(user ? { user } : {}),
      }),
    ).rejects.toThrow()

    await expect(
      payload.update({
        collection: 'exports',
        id: exportJob.id,
        data: { name: `${slugPrefix}-blocked-update` },
        overrideAccess: false,
        ...(user ? { user } : {}),
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'imports',
        id: importJob.id,
        data: { status: 'failed' },
        overrideAccess: false,
        ...(user ? { user } : {}),
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'exports',
        id: exportJob.id,
        overrideAccess: false,
        ...(user ? { user } : {}),
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({
        collection: 'imports',
        id: importJob.id,
        overrideAccess: false,
        ...(user ? { user } : {}),
      }),
    ).rejects.toThrow()
  })

  it.each([
    ['clinic', (): PayloadRequestUser | undefined => clinicUser],
    ['patient', (): PayloadRequestUser | undefined => patientUser],
    ['anonymous', (): PayloadRequestUser | undefined => undefined],
  ] as const)('blocks the generated export download endpoint for %s users', async (_label, getUser) => {
    const endpoints = payload.collections.exports.config.endpoints
    if (!Array.isArray(endpoints)) throw new Error('Expected generated export endpoints')

    const endpoint = endpoints.find(({ path }) => path === '/download')
    if (!endpoint) throw new Error('Expected generated export download endpoint')

    const response = await endpoint.handler({
      payload,
      user: getUser() ?? null,
    } as PayloadRequest)

    expect(response.status).toBe(403)
  })
})
