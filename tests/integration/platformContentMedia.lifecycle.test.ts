import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { getPayload } from 'payload'
import type { Payload, File } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, PlatformContentMedia } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

describe('PlatformContentMedia integration - lifecycle', () => {
  let payload: Payload
  const slugPrefix = testSlug('platformContentMedia.lifecycle.test.ts')
  const createdMediaIds: Array<number> = []
  const createdUserIds: Array<number> = []

  const uniqueSupabaseUserId = (suffix: string) => `${slugPrefix}-${suffix}-${randomUUID()}`

  const buildImageFile = (name: string): File => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
    const data = Buffer.from(base64, 'base64')

    return {
      name,
      data,
      mimetype: 'image/png',
      size: data.length,
    }
  }

  const asPayloadUser = (user: BasicUser): PayloadUser =>
    ({
      ...user,
      collection: 'basicUsers',
    }) as unknown as PayloadUser

  const createPlatformUser = async (suffix: string) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-${suffix}@example.com`,
        supabaseUserId: uniqueSupabaseUserId(suffix),
        userType: 'platform',
        firstName: 'Platform',
        lastName: `User-${suffix}`,
      },
      overrideAccess: true,
    })) as BasicUser

    createdUserIds.push(basicUser.id)
    return basicUser
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    while (createdMediaIds.length) {
      const id = createdMediaIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'platformContentMedia', id, overrideAccess: true })
    }

    while (createdUserIds.length) {
      const id = createdUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }
  })

  it('creates media with createdBy and computed storage path', async () => {
    const platformUser = await createPlatformUser('create')

    const created = (await payload.create({
      collection: 'platformContentMedia',
      data: {
        alt: 'Hero image',
      } as Partial<PlatformContentMedia>,
      file: buildImageFile(`${slugPrefix}-hero.png`),
      user: asPayloadUser(platformUser),
      draft: false,
      depth: 0,
      overrideAccess: false,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

    createdMediaIds.push(created.id)

    expect(created.createdBy).toBe(platformUser.id)
    expect(created.filename).toMatch(/^[a-f0-9]{10}\/.*\.png$/)
    expect(created.storagePath).toMatch(/^platform\/[a-f0-9]{10}\/.*\.png$/)
  })

  it('updates metadata without changing createdBy', async () => {
    const platformUser = await createPlatformUser('update')

    const created = (await payload.create({
      collection: 'platformContentMedia',
      data: {
        alt: 'Before alt',
      } as Partial<PlatformContentMedia>,
      file: buildImageFile(`${slugPrefix}-alt.png`),
      user: asPayloadUser(platformUser),
      draft: false,
      depth: 0,
      overrideAccess: false,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

    createdMediaIds.push(created.id)

    const updated = (await payload.update({
      collection: 'platformContentMedia',
      id: created.id,
      data: {
        alt: 'After alt',
      },
      user: asPayloadUser(platformUser),
      depth: 0,
      overrideAccess: false,
    })) as PlatformContentMedia

    expect(updated.createdBy).toBe(platformUser.id)
    expect(updated.storagePath).toMatch(/^platform\/[a-f0-9]{10}\/.*\.png$/)
  })
})
