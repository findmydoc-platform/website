import { randomUUID } from 'crypto'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload } from 'payload'
import type { CollectionSlug, Payload } from 'payload'

import config from '@payload-config'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { testSlug } from '../fixtures/testSlug'
import { resolveS3StorageConfig } from '@/plugins/storageConfig'
import type { PlatformStaff } from '@/payload-types'

type StorageDocument = {
  id: number | string
  storagePath: string
}

type StorageMatrixCase = {
  collection: CollectionSlug
  createData: (ids: { clinicId: number | string; doctorId: number | string }) => Record<string, unknown>
  expectedPath: (ids: {
    clinicId: number | string
    doctorId: number | string
    platformStaffId: number | string
  }) => RegExp
}

const storageConfig = resolveS3StorageConfig({ DEPLOYMENT_ENV: 'test' })
const slugPrefix = testSlug('storage.s3.collections.test.ts')

const storageObjectUrl = (storagePath: string): string =>
  new URL(`${storageConfig.bucket}/${storagePath}`, `${storageConfig.clientConfig.endpoint}/`).toString()

const storageMatrix: StorageMatrixCase[] = [
  {
    collection: 'platformContentMedia',
    createData: () => ({ alt: 'Platform storage matrix image' }),
    expectedPath: () => /^platform\/[a-f0-9]{10}-.+\.png$/,
  },
  {
    collection: 'clinicMedia',
    createData: ({ clinicId }) => ({ alt: 'Clinic storage matrix image', clinic: clinicId }),
    expectedPath: ({ clinicId }) => new RegExp(`^clinics/${clinicId}-[a-f0-9]{10}-.+\\.png$`),
  },
  {
    collection: 'doctorMedia',
    createData: ({ doctorId }) => ({ alt: 'Doctor storage matrix image', doctor: doctorId }),
    expectedPath: ({ doctorId }) => new RegExp(`^doctors/${doctorId}-[a-f0-9]{10}-.+\\.png$`),
  },
  {
    collection: 'userProfileMedia',
    createData: () => ({}),
    expectedPath: ({ platformStaffId }) => new RegExp(`^users/${platformStaffId}-[a-f0-9]{10}-.+\\.png$`),
  },
  {
    collection: 'clinicGalleryMedia',
    createData: ({ clinicId }) => ({ alt: 'Gallery storage matrix image', clinic: clinicId }),
    expectedPath: ({ clinicId }) => new RegExp(`^clinics-gallery/${clinicId}-cgmedia-[a-f0-9]{32}-.+\\.png$`),
  },
]

describe('S3Mock media collection matrix', () => {
  let payload: Payload
  let cityId: number
  const createdMedia: Array<{ collection: CollectionSlug; id: number | string }> = []
  const createdPlatformStaffIds: Array<number | string> = []

  const createPlatformStaff = async (): Promise<PlatformStaff> => {
    const staff = (await payload.create({
      collection: 'platformStaff',
      context: { trustedPlatformStaffOps: true },
      data: {
        email: `${slugPrefix}-${randomUUID()}@findmydoc.eu`,
        firstName: 'Storage',
        lastName: 'Matrix',
        role: 'support',
        supabaseUserId: `${slugPrefix}-${randomUUID()}`,
      },
      depth: 0,
      overrideAccess: true,
    })) as PlatformStaff

    createdPlatformStaffIds.push(staff.id)
    return staff
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityResult = await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })
    const city = cityResult.docs[0]
    if (!city) throw new Error('Expected baseline city for S3 storage matrix')
    cityId = city.id as number
  }, 60000)

  afterEach(async () => {
    await cleanupTrackedDocs(
      payload,
      storageMatrix.map(({ collection }) => ({
        collection,
        ids: createdMedia.filter((entry) => entry.collection === collection).map((entry) => entry.id),
      })),
    )
    createdMedia.length = 0

    await cleanupTrackedDocs(payload, [{ collection: 'platformStaff', ids: createdPlatformStaffIds }])
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('stores one upload per registered media collection in the test bucket', async () => {
    expect(storageConfig.bucket).toBe('findmydoc-test')

    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix })
    const platformStaff = await createPlatformStaff()
    const user = { ...platformStaff, collection: 'platformStaff' } as NonNullable<
      Parameters<Payload['create']>[0]['user']
    >
    const ids = { clinicId: clinic.id, doctorId: doctor.id, platformStaffId: platformStaff.id }

    for (const entry of storageMatrix) {
      const file = createTinyPngFile(`${slugPrefix}-${entry.collection}-${randomUUID()}.png`)
      const created = (await payload.create({
        collection: entry.collection,
        data: entry.createData(ids),
        depth: 0,
        file,
        overrideAccess: true,
        user,
      } as Parameters<Payload['create']>[0])) as StorageDocument
      createdMedia.push({ collection: entry.collection, id: created.id })

      expect(created.storagePath).toMatch(entry.expectedPath(ids))

      const response = await fetch(storageObjectUrl(created.storagePath))
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('image/png')
      expect(Buffer.from(await response.arrayBuffer())).toEqual(file.data)
    }
  })
})
