import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { createPngFile } from '../fixtures/testFiles'
import type { BasicUser, PlatformStaff } from '@/payload-types'

const richTextValue = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Post content' }],
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
}

type PlatformStaffResult = { staff: PlatformStaff; basicUserId: number | string }

async function createPlatformStaff(payload: Payload, email: string): Promise<PlatformStaffResult> {
  const basicUser = (await payload.create({
    collection: 'basicUsers',
    data: {
      email,
      userType: 'platform',
      firstName: 'Post',
      lastName: 'Author',
      supabaseUserId: `sb-${email}`,
    },
    overrideAccess: true,
  })) as BasicUser

  const staffRes = await payload.find({
    collection: 'platformStaff',
    where: { user: { equals: basicUser.id } },
    limit: 1,
    overrideAccess: true,
  })

  const staffDoc = staffRes.docs[0] as PlatformStaff | undefined
  if (!staffDoc) {
    throw new Error('Expected platform staff profile for post author')
  }

  return { staff: staffDoc, basicUserId: basicUser.id }
}

describe('Posts integration', () => {
  let payload: Payload
  const slugPrefix = testSlug('posts.integration.test.ts')
  const createdBasicUserIds: Array<number | string> = []
  const createdMediaIds: Array<number | string> = []

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

    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }

    await cleanupTestEntities(payload, 'posts', slugPrefix)
  })

  it('creates a post with slug, relationships, and content', async () => {
    const { staff, basicUserId } = await createPlatformStaff(payload, `${slugPrefix}-author@example.com`)
    createdBasicUserIds.push(basicUserId)

    const media = await payload.create({
      collection: 'platformContentMedia',
      data: {
        alt: 'Post hero',
      },
      file: createPngFile(`${slugPrefix}-hero.png`),
      overrideAccess: true,
    })
    createdMediaIds.push(media.id)

    const tagRes = await payload.find({ collection: 'tags', limit: 1, overrideAccess: true })
    const tagId = tagRes.docs[0]?.id

    const categoryRes = await payload.find({ collection: 'categories', limit: 1, overrideAccess: true })
    const categoryId = categoryRes.docs[0]?.id

    const post = await payload.create({
      collection: 'posts',
      data: {
        title: `${slugPrefix}-post`,
        tags: tagId ? [tagId] : [],
        heroImage: media.id,
        content: richTextValue,
        excerpt: 'Summary',
        categories: categoryId ? [categoryId] : [],
        authors: [staff.id],
      },
      overrideAccess: true,
    })

    expect(post.id).toBeDefined()
    expect(post.slug).toContain(`${slugPrefix}-post`)
    expect(post.authors).toContain(staff.id)
  })

  it('auto-sets publishedAt when publishing without a date', async () => {
    const post = await payload.create({
      collection: 'posts',
      data: {
        title: `${slugPrefix}-publish`,
        content: richTextValue,
        excerpt: 'Publish summary',
      },
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'posts',
      id: post.id,
      data: {
        _status: 'published',
      },
      overrideAccess: true,
    })

    expect(updated.publishedAt).toBeTruthy()
  })

  it('populates authors after read', async () => {
    const { staff, basicUserId } = await createPlatformStaff(payload, `${slugPrefix}-author2@example.com`)
    createdBasicUserIds.push(basicUserId)

    const post = await payload.create({
      collection: 'posts',
      data: {
        title: `${slugPrefix}-authors`,
        content: richTextValue,
        excerpt: 'Authors summary',
        authors: [staff.id],
      },
      overrideAccess: true,
    })

    const fetched = await payload.findByID({
      collection: 'posts',
      id: post.id,
      overrideAccess: true,
    })

    expect(fetched.populatedAuthors?.[0]?.id).toBe(staff.id)
    expect(fetched.populatedAuthors?.[0]?.name).toContain('Post Author')
  })

  it('blocks create for anonymous users', async () => {
    await expect(
      payload.create({
        collection: 'posts',
        data: {
          title: `${slugPrefix}-no-access`,
          content: richTextValue,
          excerpt: 'No access',
        },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('soft deletes a post', async () => {
    const post = await payload.create({
      collection: 'posts',
      data: {
        title: `${slugPrefix}-trash`,
        content: richTextValue,
        excerpt: 'Trash',
      },
      overrideAccess: true,
    })

    await payload.delete({
      collection: 'posts',
      id: post.id,
      overrideAccess: true,
    })

    const findResult = await payload.find({
      collection: 'posts',
      where: { id: { equals: post.id } },
      overrideAccess: true,
    })

    expect(findResult.docs).toHaveLength(0)
  })
})
