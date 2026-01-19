import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import type { Clinic, Post, Tag, Treatment } from '@/payload-types'

type PostCreateData = {
  title: string
  content: Post['content']
  excerpt: string
  tags?: Array<number>
  _status?: 'draft' | 'published'
  slug?: string
}

type TreatmentCreateData = {
  name: string
  description: Treatment['description']
  medicalSpecialty: number
  tags?: Array<number>
}

const buildRichText = (text: string): Post['content'] => ({
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

describe('Tags integration - associations and joins', () => {
  let payload: Payload
  const slugPrefix = slugify(testSlug('tags.associations.test.ts'))
  let cityId: number
  let medicalSpecialtyId: number

  const createTagAssociations = async (suffix: string) => {
    const tagName = `${slugPrefix}-${suffix}-tag`
    const tag = (await payload.create({
      collection: 'tags',
      data: { name: tagName } as Tag,
      overrideAccess: true,
      depth: 0,
    })) as Tag

    const { clinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-${suffix}`,
    })

    const updatedClinic = (await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: {
        tags: [tag.id as number],
      },
      overrideAccess: true,
      depth: 0,
    })) as Clinic

    const treatmentData: TreatmentCreateData = {
      name: `${slugPrefix}-${suffix}-treatment`,
      description: buildRichText('Treatment tagged for association tests.'),
      medicalSpecialty: medicalSpecialtyId,
      tags: [tag.id as number],
    }

    const treatment = (await payload.create({
      collection: 'treatments',
      data: treatmentData as Treatment,
      overrideAccess: true,
      depth: 0,
    })) as Treatment

    const postTitle = `${slugPrefix} ${suffix} post`
    const postData: PostCreateData = {
      title: postTitle,
      content: buildRichText('Post content for tag association tests.'),
      excerpt: 'Post excerpt for tag association tests.',
      tags: [tag.id as number],
      _status: 'draft',
      slug: slugify(postTitle),
    }

    const post = (await payload.create({
      collection: 'posts',
      data: postData as Post,
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })) as Post

    return {
      tag,
      clinic: updatedClinic,
      treatment,
      post,
    }
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for tag association tests')
    cityId = cityDoc.id as number

    const specialtyRes = await payload.find({
      collection: 'medical-specialties',
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })
    const specialtyDoc = specialtyRes.docs[0]
    if (!specialtyDoc) throw new Error('Expected baseline specialty for tag association tests')
    medicalSpecialtyId = specialtyDoc.id as number
  }, 60000)

  afterEach(async () => {
    await cleanupTestEntities(payload, 'posts', slugPrefix)
    await cleanupTestEntities(payload, 'treatments', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'tags', slugPrefix)
  })

  it('exposes clinic, treatment, and post joins for a tag', async () => {
    const { tag, clinic, treatment, post } = await createTagAssociations('join')

    const hydratedTag = (await payload.findByID({
      collection: 'tags',
      id: tag.id,
      overrideAccess: true,
      depth: 2,
      joins: {
        clinics: { limit: 10 },
        treatments: { limit: 10 },
        posts: { limit: 10 },
      },
    })) as Tag

    const clinicIds = (hydratedTag.clinics?.docs ?? []).map((doc) => (typeof doc === 'object' ? doc.id : doc))
    const treatmentIds = (hydratedTag.treatments?.docs ?? []).map((doc) => (typeof doc === 'object' ? doc.id : doc))
    const postIds = (hydratedTag.posts?.docs ?? []).map((doc) => (typeof doc === 'object' ? doc.id : doc))

    expect(clinicIds).toContain(clinic.id)
    expect(treatmentIds).toContain(treatment.id)
    expect(postIds).toContain(post.id)
  })

  it('removes deleted tags from populated relationships', async () => {
    const { tag, clinic, treatment, post } = await createTagAssociations('delete')

    await payload.delete({
      collection: 'tags',
      id: tag.id,
      overrideAccess: true,
    })

    const clinicAfterDelete = (await payload.findByID({
      collection: 'clinics',
      id: clinic.id,
      overrideAccess: true,
      depth: 1,
    })) as Clinic

    const clinicTagIds = (clinicAfterDelete.tags ?? []).map((item) => (typeof item === 'object' ? item.id : item))

    const treatmentAfterDelete = (await payload.findByID({
      collection: 'treatments',
      id: treatment.id,
      overrideAccess: true,
      depth: 1,
    })) as Treatment

    const treatmentTagIds = (treatmentAfterDelete.tags ?? []).map((item) => (typeof item === 'object' ? item.id : item))

    const postAfterDelete = (await payload.findByID({
      collection: 'posts',
      id: post.id,
      overrideAccess: true,
      depth: 1,
    })) as Post

    const postTagIds = (postAfterDelete.tags ?? []).map((item) => (typeof item === 'object' ? item.id : item))

    expect(clinicTagIds).not.toContain(tag.id)
    expect(treatmentTagIds).not.toContain(tag.id)
    expect(postTagIds).not.toContain(tag.id)
  })
})
