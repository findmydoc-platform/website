import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { buildRichText, buildRichTextWithInternalPostLink } from '../fixtures/richText'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'
import { findPostBySlug, findPublishedPostsPage } from '@/utilities/content/serverData'
import type { Post, Tag, Category, BasicUser } from '@/payload-types'
import demoPosts from '@/endpoints/seed/data/demo/posts.json'

type CreatedUser = {
  basicUserId: number
  name: string
}

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

  const createAuthor = async (identifier: string): Promise<CreatedUser> => {
    const basicUser = await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${identifier}@example.com`,
        supabaseUserId: `sb-${identifier}`,
        userType: 'platform',
        firstName: 'Post',
        lastName: 'Author',
      } as unknown as BasicUser,
      overrideAccess: true,
    })

    createdBasicUserIds.push(Number(basicUser.id))

    return {
      basicUserId: Number(basicUser.id),
      name: `${basicUser.firstName} ${basicUser.lastName}`,
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
    const author = await createAuthor(`${slugPrefix}-author`)

    const created = await payload.create({
      collection: 'posts',
      data: buildPostData({
        title,
        tagId,
        categoryId,
        authorId: author.basicUserId,
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
    expect(read.authors).toContain(Number(author.basicUserId))
    expect(read.populatedAuthors?.[0]?.name).toBe(author.name)
  })

  it('keeps populated authors on related post cards returned by post detail queries', async () => {
    const author = await createAuthor(`${slugPrefix}-related-author`)

    const relatedPost = await payload.create({
      collection: 'posts',
      data: buildPostData({
        title: `${slugPrefix} related child`,
        authorId: author.basicUserId,
        status: 'draft',
      }),
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const parentPost = await payload.create({
      collection: 'posts',
      data: {
        ...buildPostData({
          title: `${slugPrefix} related parent`,
          status: 'draft',
        }),
        relatedPosts: [Number(relatedPost.id)],
      },
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const read = await findPostBySlug(payload, String(parentPost.slug), true)

    const relatedDoc = read?.relatedPosts?.[0]

    expect(typeof relatedDoc).toBe('object')
    expect(relatedDoc && typeof relatedDoc === 'object' ? relatedDoc.populatedAuthors?.[0]?.name : undefined).toBe(
      author.name,
    )
  })

  it('keeps internal post links populated on detail queries', async () => {
    const linkedPost = await payload.create({
      collection: 'posts',
      data: buildPostData({
        title: `${slugPrefix} linked child`,
        status: 'draft',
      }),
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const parentPost = await payload.create({
      collection: 'posts',
      data: {
        ...buildPostData({
          title: `${slugPrefix} link parent`,
          status: 'draft',
        }),
        content: buildRichTextWithInternalPostLink({
          beforeText: 'Read ',
          linkText: 'this related article',
          postId: Number(linkedPost.id),
        }),
      },
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const read = await findPostBySlug(payload, String(parentPost.slug), true)

    const paragraph = read?.content?.root?.children?.[0]
    const linkNode =
      paragraph && typeof paragraph === 'object' && Array.isArray(paragraph.children)
        ? paragraph.children.find(
            (child): child is { fields?: { doc?: { value?: unknown } } } =>
              typeof child === 'object' && child !== null && 'type' in child && child.type === 'link',
          )
        : undefined

    expect(linkNode?.fields?.doc?.value).toEqual(
      expect.objectContaining({
        id: Number(linkedPost.id),
        slug: String(linkedPost.slug),
      }),
    )
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

  it('stores german localized content while falling back to english defaults', async () => {
    const title = `${slugPrefix} localized post`

    const created = await payload.create({
      collection: 'posts',
      data: buildPostData({
        title,
        includeMeta: true,
        status: 'published',
      }),
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const germanContent = buildRichText('Deutscher Beitragsinhalt.')

    await payload.update({
      collection: 'posts',
      id: created.id,
      locale: 'de',
      data: {
        title: `${title} de`,
        content: germanContent,
        excerpt: 'Kurzer deutscher Auszug.',
        meta: {
          title: `${title} SEO titel`,
        },
      },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const localizedPost = await findPostBySlug(payload, String(created.slug), false, {
      locale: 'de',
      fallbackLocale: 'en',
    })

    expect(localizedPost?.slug).toBe(created.slug)
    expect(localizedPost?.title).toBe(`${title} de`)
    expect(localizedPost?.content).toEqual(germanContent)
    expect(localizedPost?.excerpt).toBe('Kurzer deutscher Auszug.')
    expect(localizedPost?.meta?.title).toBe(`${title} SEO titel`)
    expect(localizedPost?.meta?.description).toBe('SEO description for integration tests.')
  })

  it('stores demo seed rich text blocks per locale', async () => {
    const seedPost = demoPosts[0]
    if (!seedPost) {
      throw new Error('Expected at least one demo post seed record')
    }

    const title = `${slugPrefix} demo seed rich text`
    const slug = slugify(title)

    const created = await payload.create({
      collection: 'posts',
      data: {
        stableId: `${slug}-stable`,
        title,
        slug,
        content: seedPost.content.en as PostCreateData['content'],
        excerpt: seedPost.excerpt.en,
        _status: 'published',
        meta: {
          title: seedPost.meta.title.en,
          description: seedPost.meta.description.en,
        },
      },
      overrideAccess: true,
      context: { disableRevalidate: true, disableSearchSync: true },
    })

    await payload.update({
      collection: 'posts',
      id: created.id,
      locale: 'de',
      data: {
        title: `${title} de`,
        content: seedPost.content.de as PostCreateData['content'],
        excerpt: seedPost.excerpt.de,
        meta: {
          title: seedPost.meta.title.de,
          description: seedPost.meta.description.de,
        },
      },
      overrideAccess: true,
      context: { disableRevalidate: true, disableSearchSync: true },
    })

    const localizedPost = await findPostBySlug(payload, slug, false, {
      locale: 'de',
      fallbackLocale: 'en',
    })

    expect(localizedPost?.content).toEqual(seedPost.content.de)
    expect(JSON.stringify(localizedPost?.content)).toContain('"blockType":"banner"')
  })

  it('returns german localized values from published post list queries', async () => {
    const title = `${slugPrefix} localized post list`

    const created = await payload.create({
      collection: 'posts',
      data: buildPostData({
        title,
        includeMeta: true,
        status: 'published',
      }),
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    await payload.update({
      collection: 'posts',
      id: created.id,
      locale: 'de',
      data: {
        content: buildRichText('Deutscher Listeninhalt.'),
        title: `${title} de`,
        excerpt: 'Kurzer deutscher Listen-Auszug.',
        meta: {
          description: 'Deutsche SEO Beschreibung.',
        },
      },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const localizedList = await findPublishedPostsPage(payload, {
      contentLocale: {
        locale: 'de',
        fallbackLocale: 'en',
      },
      limit: 10,
      pagination: false,
      where: {
        slug: {
          equals: String(created.slug),
        },
      },
    })

    expect(localizedList.docs).toHaveLength(1)
    expect(localizedList.docs[0]?.title).toBe(`${title} de`)
    expect(localizedList.docs[0]?.excerpt).toBe('Kurzer deutscher Listen-Auszug.')
    expect(localizedList.docs[0]?.meta?.description).toBe('Deutsche SEO Beschreibung.')
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

    expect(findResult.docs).toHaveLength(1)
    expect(findResult.docs[0]?.id).toBe(created.id)

    const publicFindResult = await payload.find({
      collection: 'posts',
      where: { id: { equals: created.id } },
      overrideAccess: false,
    })

    expect(publicFindResult.docs).toHaveLength(0)
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
