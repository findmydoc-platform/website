import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'
import type { Post, Tag, Category, BasicUser } from '@/payload-types'

type CreatedUser = {
  basicUserId: number
  platformStaffId: number
  name: string
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

type PostCreateData = Partial<Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>> &
  Pick<Post, 'title' | 'content' | 'excerpt' | 'slug'>

const buildPostData = (args: {
  title: string
  tagId?: number
  categoryId?: number
  authorId?: number
  status?: 'draft' | 'published'
  includeMeta?: boolean
}): PostCreateData => ({
  title: args.title,
  content: buildRichText('Post content for integration tests.'),
  excerpt: 'Short excerpt used for previews.',
  tags: args.tagId ? [args.tagId] : undefined,
  categories: args.categoryId ? [args.categoryId] : undefined,
  authors: args.authorId ? [args.authorId] : undefined,
  _status: args.status ?? 'draft',
  meta: args.includeMeta
    ? {
        title: `${args.title} SEO title`,
        description: 'SEO description for integration tests.',
      }
    : undefined,
  slug: slugify(args.title),
})

describe('Posts integration - lifecycle and access', () => {
  let payload: Payload
  const slugPrefix = slugify(testSlug('posts.lifecycle.test.ts'))
  const createdBasicUserIds: Array<number | string> = []

  const ensureTag = async (): Promise<number> => {
    const res = await payload.find({ collection: 'tags', limit: 1, overrideAccess: true, depth: 0 })
    const doc = res.docs[0]
    if (doc) return Number(doc.id)

    const name = `${slugPrefix}-tag`
    const created = await payload.create({
      collection: 'tags',
      data: { name, slug: slugify(name) } as unknown as Tag,
      overrideAccess: true,
    })
    return Number(created.id)
  }

  const ensureCategory = async (): Promise<number> => {
    const res = await payload.find({ collection: 'categories', limit: 1, overrideAccess: true, depth: 0 })
    const doc = res.docs[0]
    if (doc) return Number(doc.id)

    const title = `${slugPrefix}-category`
    const created = await payload.create({
      collection: 'categories',
      data: { title, slug: slugify(title) } as unknown as Category,
      overrideAccess: true,
    })
    return Number(created.id)
  }

  const createPlatformStaff = async (identifier: string): Promise<CreatedUser> => {
    const basicUser = await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${identifier}@example.com`,
        userType: 'platform',
        firstName: 'Post',
        lastName: 'Author',
      } as unknown as BasicUser,
      overrideAccess: true,
    })

    createdBasicUserIds.push(Number(basicUser.id))

    const staffRes = await payload.find({
      collection: 'platformStaff',
      where: { user: { equals: basicUser.id } },
      limit: 1,
      overrideAccess: true,
    })

    const staffDoc = staffRes.docs[0]
    if (!staffDoc) throw new Error('Expected platform staff profile for post author')

    return {
      basicUserId: Number(basicUser.id),
      platformStaffId: Number(staffDoc.id),
      name: 'Post Author',
    }
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'posts', slugPrefix)

    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
      } catch {
        // ignore cleanup errors
      }
    }
  })

  it('creates a draft post and generates slug from title', async () => {
    const title = `${slugPrefix} draft post`

    const created = await payload.create({
      collection: 'posts',
      data: buildPostData({ title, status: 'draft' }),
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    expect(created.title).toBe(title)
    expect(created.slug).toBe(slugify(title))
    expect(created._status).toBe('draft')
  })

  it('creates a post with tags, categories, and authors; populates authors on read', async () => {
    const title = `${slugPrefix} relationships`
    const tagId = await ensureTag()
    const categoryId = await ensureCategory()
    const author = await createPlatformStaff(`${slugPrefix}-author`)

    const created = await payload.create({
      collection: 'posts',
      data: buildPostData({
        title,
        tagId,
        categoryId,
        authorId: author.platformStaffId,
        status: 'draft',
      }),
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const read = await payload.findByID({
      collection: 'posts',
      id: created.id,
      overrideAccess: true,
      depth: 0,
    })

    expect(read.tags).toContain(Number(tagId))
    expect(read.categories).toContain(Number(categoryId))
    expect(read.authors).toContain(Number(author.platformStaffId))
    expect(read.populatedAuthors?.[0]?.name).toBe(author.name)
  })

  it('allows setting and updating SEO fields', async () => {
    const title = `${slugPrefix} seo`

    const created = await payload.create({
      collection: 'posts',
      data: buildPostData({ title, includeMeta: true }),
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    expect(created.meta?.title).toBe(`${title} SEO title`)
    expect(created.meta?.description).toBe('SEO description for integration tests.')

    const updated = await payload.update({
      collection: 'posts',
      id: created.id,
      data: {
        meta: {
          title: `${title} updated`,
          description: 'Updated SEO description.',
        },
      },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    expect(updated.meta?.title).toBe(`${title} updated`)
    expect(updated.meta?.description).toBe('Updated SEO description.')
  })

  it('publishes a post and auto-populates publishedAt when missing', async () => {
    const title = `${slugPrefix} publish`

    const created = await payload.create({
      collection: 'posts',
      data: buildPostData({ title, status: 'draft' }),
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const updated = await payload.update({
      collection: 'posts',
      id: created.id,
      data: {
        _status: 'published',
      },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    expect(updated._status).toBe('published')
    expect(updated.publishedAt).toBeTruthy()
  })

  it('soft deletes a post (trash functionality)', async () => {
    const title = `${slugPrefix} trash post`

    const created = await payload.create({
      collection: 'posts',
      data: buildPostData({ title, status: 'draft' }),
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    await payload.delete({
      collection: 'posts',
      id: created.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const findResult = await payload.find({
      collection: 'posts',
      where: { id: { equals: created.id } },
      overrideAccess: true,
    })

    expect(findResult.docs).toHaveLength(0)

    await expect(
      payload.findByID({
        collection: 'posts',
        id: created.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('allows public read for published posts but blocks unauthenticated create', async () => {
    const title = `${slugPrefix} public read`

    const created = await payload.create({
      collection: 'posts',
      data: buildPostData({ title, status: 'draft' }),
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    await payload.update({
      collection: 'posts',
      id: created.id,
      data: { _status: 'published' },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const publicRead = await payload.find({
      collection: 'posts',
      where: { id: { equals: created.id } },
      overrideAccess: false,
    })

    expect(publicRead.docs).toHaveLength(1)
    expect(publicRead.docs[0]?.title).toBe(title)

    await expect(
      payload.create({
        collection: 'posts',
        data: buildPostData({ title: `${slugPrefix} should-fail`, status: 'draft' }),
        draft: true,
        overrideAccess: false,
        context: { disableRevalidate: true },
      } as Parameters<Payload['create']>[0]),
    ).rejects.toThrow()
  })
})
