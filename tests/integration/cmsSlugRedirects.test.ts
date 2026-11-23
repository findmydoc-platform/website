import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/internal/cms-redirects/route'
import { proxy } from '@/proxy'

vi.mock('@/features/temporaryLandingMode/resolver', () => ({
  resolveHoldingMode: async () => ({ mode: 'full' }),
}))

import { buildRichText } from '../fixtures/richText'
import { testSlug } from '../fixtures/testSlug'

describe('CMS slug redirects after publication', () => {
  const fixture = testSlug('cms-slug-redirects', randomUUID().slice(0, 8))
  const documents: { collection: 'pages' | 'posts'; id: number }[] = []
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterEach(async () => {
    await payload.delete({
      collection: 'redirects',
      where: { from: { contains: fixture } },
      context: { disableRevalidate: true },
    })
    for (const { collection, id } of documents.splice(0)) {
      await payload.delete({ collection, id, trash: true, context: { disableRevalidate: true } })
    }
  })

  afterAll(async () => {
    await payload?.destroy()
  })

  const findFixtureRedirects = async () =>
    (
      await payload.find({
        collection: 'redirects',
        depth: 0,
        where: { from: { contains: fixture } },
      })
    ).docs

  const publishPostAt = async (slug: string) => {
    const post = await payload.create({
      collection: 'posts',
      locale: 'en',
      fallbackLocale: false,
      draft: false,
      data: {
        title: 'English article',
        excerpt: 'English article excerpt',
        content: buildRichText('English article content'),
        slug,
        generateSlug: false,
        _status: 'published',
      },
    })
    documents.push({ collection: 'posts', id: post.id })
    return post
  }

  const renamePost = (id: number, slug: string) =>
    payload.update({
      collection: 'posts',
      id,
      locale: 'en',
      publishSpecificLocale: 'en',
      fallbackLocale: false,
      draft: false,
      data: { slug, generateSlug: false, _status: 'published' },
    })

  for (const collection of ['pages', 'posts'] as const) {
    it(`keeps ${collection} direct links aligned with native English publication and withdrawal`, async () => {
      const germanSlug = `${fixture}-${collection}-german`
      const englishSlug = `${fixture}-${collection}-english`
      const body = (title: string, slug: string) => ({
        title,
        slug,
        generateSlug: false,
        excerpt: title,
        content: buildRichText(title),
        layout: [
          {
            blockType: 'content' as const,
            columns: [{ size: 'full' as const, richText: buildRichText(title) }],
          },
        ],
      })

      const document = await payload.create({
        collection,
        locale: 'de',
        fallbackLocale: false,
        draft: false,
        data: { ...body('German content', germanSlug), _status: 'published' },
      })
      documents.push({ collection, id: document.id })

      const englishInput = {
        collection,
        id: document.id,
        locale: 'en',
        fallbackLocale: false,
      } as const
      await payload.update({
        ...englishInput,
        draft: true,
        data: { ...body('English content', englishSlug), _status: 'draft' },
      })

      const origin = 'https://findmydoc.eu'
      const prefix = collection === 'posts' ? '/posts/' : '/'
      const germanPath = `${prefix}${germanSlug}`
      const recognizablePath = `/en${germanPath}`
      const englishPath = `/en${prefix}${englishSlug}`
      const open = (path: string) => proxy(new NextRequest(`${origin}${path}`))

      vi.stubEnv('VERCEL', undefined)
      vi.stubEnv('VERCEL_URL', undefined)
      vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'production')
      vi.stubEnv('NEXT_PUBLIC_SERVER_URL', origin)
      vi.stubGlobal('fetch', async (url: URL, init: RequestInit) => POST(new Request(url, init)))

      try {
        const draftNotice = await open(recognizablePath)
        expect(draftNotice.status).toBe(200)
        expect(draftNotice.headers.get('location')).toBeNull()
        expect(draftNotice.headers.get('x-robots-tag')).toContain('noindex')
        expect((await open(englishPath)).headers.get('x-robots-tag')).toBeNull()

        await payload.update({
          ...englishInput,
          publishSpecificLocale: 'en',
          draft: false,
          data: { ...body('English content', englishSlug), _status: 'published' },
        })
        const afterPublishing = await open(recognizablePath)
        expect(afterPublishing.status).toBe(302)
        expect(afterPublishing.headers.get('location')).toBe(`${origin}${englishPath}`)
        expect((await open(englishPath)).headers.get('location')).toBeNull()

        await payload.update({ ...englishInput, draft: false, data: { _status: 'draft' } })
        const withdrawn = await open(englishPath)
        expect(withdrawn.status).toBe(200)
        expect(withdrawn.headers.get('location')).toBeNull()
        expect(withdrawn.headers.get('x-robots-tag')).toContain('noindex')
      } finally {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
      }
    })
  }

  it('records the previous English Post path when an editor publishes a new English slug', async () => {
    const oldSlug = `${fixture}-old`
    const post = await publishPostAt(oldSlug)
    const germanSlug = `${fixture}-de`
    await payload.update({
      collection: 'posts',
      id: post.id,
      locale: 'de',
      publishSpecificLocale: 'de',
      fallbackLocale: false,
      draft: false,
      data: {
        title: 'German article',
        excerpt: 'German article excerpt',
        content: buildRichText('German article content'),
        slug: germanSlug,
        generateSlug: false,
        _status: 'published',
      },
    })
    await renamePost(post.id, `${fixture}-new`)

    const germanPost = await payload.findByID({
      collection: 'posts',
      id: post.id,
      locale: 'de',
      fallbackLocale: false,
      draft: false,
      overrideAccess: false,
    })
    expect(germanPost).toMatchObject({ slug: germanSlug, _status: 'published' })

    expect(await findFixtureRedirects()).toMatchObject([
      {
        from: `/en/posts/${oldSlug}`,
        type: '301',
        to: { type: 'reference', reference: { relationTo: 'posts', value: post.id } },
      },
    ])
  })

  it('leaves a Page URL alone until the editor publishes the changed slug', async () => {
    const oldSlug = `${fixture}-page-old`
    const newSlug = `${fixture}-page-new`
    const page = await payload.create({
      collection: 'pages',
      locale: 'de',
      fallbackLocale: false,
      draft: false,
      data: {
        title: 'German page',
        layout: [
          {
            blockType: 'content',
            columns: [{ size: 'full', richText: buildRichText('German page content') }],
          },
        ],
        slug: oldSlug,
        generateSlug: false,
        _status: 'published',
      },
    })
    documents.push({ collection: 'pages', id: page.id })
    expect(await findFixtureRedirects()).toEqual([])

    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'de',
      fallbackLocale: false,
      draft: true,
      data: { slug: newSlug, generateSlug: false, _status: 'draft' },
    })
    expect(await findFixtureRedirects()).toEqual([])

    const publish = () =>
      payload.update({
        collection: 'pages',
        id: page.id,
        locale: 'de',
        publishSpecificLocale: 'de',
        fallbackLocale: false,
        draft: false,
        data: { slug: newSlug, generateSlug: false, _status: 'published' },
      })
    await publish()
    await publish()
    expect(await findFixtureRedirects()).toMatchObject([
      {
        from: `/${oldSlug}`,
        type: '301',
        to: { type: 'reference', reference: { relationTo: 'pages', value: page.id } },
      },
    ])
  })

  it('redirects a reused source to the latest public owner when it moves', async () => {
    const source = `${fixture}-reused`
    const first = await publishPostAt(source)
    await renamePost(first.id, `${fixture}-first-owner`)
    const latest = await publishPostAt(source)
    await renamePost(latest.id, `${fixture}-latest-owner`)

    expect(await findFixtureRedirects()).toMatchObject([
      {
        from: `/en/posts/${source}`,
        type: '301',
        to: { type: 'reference', reference: { relationTo: 'posts', value: latest.id } },
      },
    ])
  })

  it('preserves the manually configured rule when an editor renames a Post', async () => {
    const slug = `${fixture}-manual`
    const post = await publishPostAt(slug)
    const rule = await payload.create({
      collection: 'redirects',
      data: { from: `/en/posts/${slug}`, to: { type: 'custom', url: '/manual-destination' } },
    })
    await renamePost(post.id, `${fixture}-manual-renamed`)

    expect(await findFixtureRedirects()).toMatchObject([
      {
        id: rule.id,
        from: `/en/posts/${slug}`,
        type: '307',
        to: { type: 'custom', url: '/manual-destination' },
      },
    ])
  })

  it('recovers the old public path when a withdrawn translation is published under a different slug', async () => {
    const oldSlug = `${fixture}-withdrawn`
    const post = await publishPostAt(oldSlug)
    await payload.update({
      collection: 'posts',
      id: post.id,
      locale: 'en',
      fallbackLocale: false,
      draft: false,
      data: { _status: 'draft' },
    })

    await renamePost(post.id, `${fixture}-republished`)

    expect(await findFixtureRedirects()).toMatchObject([
      {
        from: `/en/posts/${oldSlug}`,
        type: '301',
        to: { type: 'reference', reference: { relationTo: 'posts', value: post.id } },
      },
    ])
  })
})
