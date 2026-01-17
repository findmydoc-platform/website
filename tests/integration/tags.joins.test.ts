import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

const richTextValue = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Tag content' }],
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
}

describe('Tags join integration', () => {
  let payload: Payload
  let cityId: number
  let specialtyId: number
  const slugPrefix = testSlug('tags.joins.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for tags join tests')
    cityId = cityDoc.id as number

    const specialtyRes = await payload.find({
      collection: 'medical-specialties',
      limit: 1,
      overrideAccess: true,
    })
    const specialtyDoc = specialtyRes.docs[0]
    if (!specialtyDoc) throw new Error('Expected baseline specialty for tags join tests')
    specialtyId = specialtyDoc.id as number
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'tags', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'posts', slugPrefix)
    await cleanupTestEntities(payload, 'treatments', slugPrefix)
  })

  it('populates tag join lists for posts, clinics, and treatments', async () => {
    const tag = await payload.create({
      collection: 'tags',
      data: { name: `${slugPrefix}-tag` },
      overrideAccess: true,
    })

    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic`,
        address: {
          street: 'Tag Street',
          houseNumber: '1',
          zipCode: 12000,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 1111111',
          email: `${slugPrefix}@example.com`,
        },
        supportedLanguages: ['english'],
        status: 'approved',
        tags: [tag.id],
      },
      overrideAccess: true,
    })

    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-treatment`,
        description: richTextValue,
        medicalSpecialty: specialtyId,
        tags: [tag.id],
      },
      overrideAccess: true,
    })

    const post = await payload.create({
      collection: 'posts',
      data: {
        title: `${slugPrefix}-post`,
        content: richTextValue,
        excerpt: 'Tagged post',
        tags: [tag.id],
      },
      overrideAccess: true,
    })

    const updatedTag = await payload.findByID({
      collection: 'tags',
      id: tag.id,
      overrideAccess: true,
    })

    expect(updatedTag.posts?.length).toBeGreaterThanOrEqual(1)
    expect(updatedTag.clinics?.length).toBeGreaterThanOrEqual(1)
    expect(updatedTag.treatments?.length).toBeGreaterThanOrEqual(1)

    expect(updatedTag.posts?.[0]).toBeDefined()
    expect(updatedTag.clinics?.[0]).toBeDefined()
    expect(updatedTag.treatments?.[0]).toBeDefined()

    await payload.delete({ collection: 'posts', id: post.id, overrideAccess: true })
    await payload.delete({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    await payload.delete({ collection: 'treatments', id: treatment.id, overrideAccess: true })
  })
})
