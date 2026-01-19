import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload, File } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import type { Accreditation, BasicUser, PlatformContentMedia } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

describe('Accreditation lifecycle integration', () => {
  let payload: Payload
  const slugPrefix = testSlug('accreditation.lifecycle.test.ts')
  const createdAccreditationIds: Array<number> = []
  const createdMediaIds: Array<number> = []
  const createdUserIds: Array<number> = []

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

  const buildRichText = (text: string) => ({
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', text }],
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  })

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
        userType: 'platform',
        firstName: 'Platform',
        lastName: `User-${suffix}`,
        supabaseUserId: `sb-${slugPrefix}-${suffix}`,
      },
      overrideAccess: true,
      depth: 0,
    })) as BasicUser

    createdUserIds.push(basicUser.id)

    return basicUser
  }

  const createPlatformContentMedia = async (suffix: string, platformUser: BasicUser) => {
    const created = (await payload.create({
      collection: 'platformContentMedia',
      data: {
        alt: `Accreditation icon ${suffix}`,
      } as Partial<PlatformContentMedia>,
      file: buildImageFile(`${slugPrefix}-icon-${suffix}.png`),
      user: asPayloadUser(platformUser),
      draft: false,
      depth: 0,
      overrideAccess: false,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

    createdMediaIds.push(created.id)

    return created
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    while (createdAccreditationIds.length) {
      const id = createdAccreditationIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'accreditation', id, overrideAccess: true })
    }

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

  it('creates accreditation with required fields and icon', async () => {
    const platformUser = await createPlatformUser('create')
    const icon = await createPlatformContentMedia('create', platformUser)

    const accreditation = (await payload.create({
      collection: 'accreditation',
      data: {
        name: 'International Quality Accreditation',
        abbreviation: 'IQA',
        country: 'Germany',
        description: buildRichText('Accreditation description'),
        icon: icon.id,
      } as unknown as Accreditation,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as Accreditation

    createdAccreditationIds.push(accreditation.id)

    expect(accreditation.name).toBe('International Quality Accreditation')
    expect(accreditation.abbreviation).toBe('IQA')
    expect(accreditation.country).toBe('Germany')
    expect(accreditation.icon).toBe(icon.id)
  })

  it('updates accreditation fields', async () => {
    const platformUser = await createPlatformUser('update')
    const icon = await createPlatformContentMedia('update', platformUser)

    const accreditation = (await payload.create({
      collection: 'accreditation',
      data: {
        name: 'Original Accreditation',
        abbreviation: 'OA',
        country: 'France',
        description: buildRichText('Original description'),
        icon: icon.id,
      } as unknown as Accreditation,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as Accreditation

    createdAccreditationIds.push(accreditation.id)

    const nextIcon = await createPlatformContentMedia('update-next', platformUser)

    const updated = (await payload.update({
      collection: 'accreditation',
      id: accreditation.id,
      data: {
        name: 'Updated Accreditation',
        abbreviation: 'UA',
        country: 'Spain',
        description: buildRichText('Updated description'),
        icon: nextIcon.id,
      } as unknown as Accreditation,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as Accreditation

    expect(updated.name).toBe('Updated Accreditation')
    expect(updated.abbreviation).toBe('UA')
    expect(updated.country).toBe('Spain')
    expect(updated.icon).toBe(nextIcon.id)
  })

  it('deletes accreditation', async () => {
    const platformUser = await createPlatformUser('delete')
    const icon = await createPlatformContentMedia('delete', platformUser)

    const accreditation = (await payload.create({
      collection: 'accreditation',
      data: {
        name: 'Temporary Accreditation',
        abbreviation: 'TA',
        country: 'Italy',
        description: buildRichText('Temporary description'),
        icon: icon.id,
      } as unknown as Accreditation,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as Accreditation

    await payload.delete({
      collection: 'accreditation',
      id: accreditation.id,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
    })

    await expect(
      payload.findByID({
        collection: 'accreditation',
        id: accreditation.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
