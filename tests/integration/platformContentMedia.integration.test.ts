import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { createLargeFile, createPngFile } from '../fixtures/testFiles'
import type { BasicUser } from '@/payload-types'

describe('PlatformContentMedia integration', () => {
  let payload: Payload
  const slugPrefix = testSlug('platformContentMedia.integration.test.ts')
  const createdBasicUserIds: Array<string | number> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }

    const { docs } = await payload.find({
      collection: 'platformContentMedia',
      where: { alt: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'platformContentMedia', id: doc.id, overrideAccess: true })
    }
  })

  it('uploads media and sets storagePath and createdBy', async () => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}@example.com`,
        userType: 'platform',
        firstName: 'Media',
        lastName: 'Uploader',
        supabaseUserId: `sb-${slugPrefix}`,
      },
      overrideAccess: true,
    })) as BasicUser
    createdBasicUserIds.push(basicUser.id)

    const media = await payload.create({
      collection: 'platformContentMedia',
      data: {
        alt: `${slugPrefix} Integration media`,
      },
      file: createPngFile(`${slugPrefix}.png`),
      overrideAccess: false,
      user: { ...basicUser, collection: 'basicUsers' },
    })

    expect(media.id).toBeDefined()
    expect(media.storagePath).toContain('platform')
    expect(media.createdBy).toBe(basicUser.id)
  })

  it('rejects missing alt text', async () => {
    await expect(
      payload.create({
        collection: 'platformContentMedia',
        data: {},
        file: createPngFile(`${slugPrefix}-no-alt.png`),
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('rejects uploads over the file size limit', async () => {
    const largeFile = createLargeFile(5 * 1024 * 1024 + 1024, `${slugPrefix}-large.png`)

    await expect(
      payload.create({
        collection: 'platformContentMedia',
        data: {
          alt: 'Too large',
        },
        file: largeFile,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
