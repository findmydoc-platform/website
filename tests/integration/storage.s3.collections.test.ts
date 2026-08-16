import { randomBytes, randomUUID } from 'crypto'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload } from 'payload'
import type { CollectionSlug, Payload } from 'payload'
import sharp from 'sharp'

import config from '@payload-config'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { testSlug } from '../fixtures/testSlug'
import { resolveS3StorageConfig } from '@/plugins/storageConfig'
import type { ClinicMedia, PlatformStaff } from '@/payload-types'
import { cleanupClinicGalleryDraftMedia } from '@/features/clinicDashboard/gallery/cleanup'

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

  it('hard-deletes a discarded clinic gallery draft and every generated S3 variant', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-gallery-cleanup` })
    const platformStaff = await createPlatformStaff()
    const user = { ...platformStaff, collection: 'platformStaff' } as NonNullable<
      Parameters<Payload['create']>[0]['user']
    >
    const data = await sharp({
      create: { width: 2_000, height: 1_200, channels: 3, background: '#526b7a' },
    })
      .jpeg()
      .toBuffer()
    const media = (await payload.create({
      collection: 'clinicMedia',
      data: { alt: 'Discarded clinic gallery draft', clinic: clinic.id },
      depth: 0,
      file: {
        data,
        mimetype: 'image/jpeg',
        name: `${slugPrefix}-gallery-cleanup.jpg`,
        size: data.length,
      },
      overrideAccess: true,
      user,
    } as Parameters<Payload['create']>[0])) as ClinicMedia

    const keys = [
      media.storagePath,
      ...Object.values(media.sizes ?? {}).flatMap((size) =>
        size?.filename ? [`clinics/${size.filename.replace(/^clinics\//u, '')}`] : [],
      ),
    ]
    expect(keys.length).toBeGreaterThan(1)
    for (const key of keys) expect((await fetch(storageObjectUrl(key))).status).toBe(200)

    await cleanupClinicGalleryDraftMedia(payload, clinic.id, [String(media.id)], 'discard')

    await expect(
      payload.findByID({ collection: 'clinicMedia', id: media.id, overrideAccess: true, trash: true }),
    ).rejects.toThrow()
    for (const key of keys) expect((await fetch(storageObjectUrl(key))).status).toBe(404)
  })

  it('accepts three near-limit clinic gallery uploads concurrently as separate requests', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-parallel-gallery` })
    const platformStaff = await createPlatformStaff()
    const user = { ...platformStaff, collection: 'platformStaff' } as NonNullable<
      Parameters<Payload['create']>[0]['user']
    >
    const source = await sharp(randomBytes(1_800 * 1_800 * 3), { raw: { width: 1_800, height: 1_800, channels: 3 } })
      .jpeg({ quality: 95 })
      .toBuffer()
    expect(source.length).toBeLessThanOrEqual(4 * 1024 * 1024)
    expect(source.length).toBeGreaterThan(2 * 1024 * 1024)

    const uploads = await Promise.all(
      Array.from({ length: 3 }, async (_, index) => {
        const media = (await payload.create({
          collection: 'clinicMedia',
          data: { alt: `Parallel clinic gallery upload ${index + 1}`, clinic: clinic.id },
          depth: 0,
          file: {
            data: source,
            mimetype: 'image/jpeg',
            name: `${slugPrefix}-parallel-${index + 1}.jpg`,
            size: source.length,
          },
          overrideAccess: true,
          user,
        } as Parameters<Payload['create']>[0])) as ClinicMedia
        createdMedia.push({ collection: 'clinicMedia', id: media.id })
        return media
      }),
    )

    expect(uploads).toHaveLength(3)
    for (const media of uploads) expect((await fetch(storageObjectUrl(media.storagePath))).status).toBe(200)
  })
})
