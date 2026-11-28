import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PayloadMcpApiKey, PlatformContentMedia } from '@/payload-types'
import { findPostSitemapDocs, findPublishedPostsPage, findPublicPostRoute } from '@/utilities/content/serverData'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { buildRichText } from '../fixtures/richText'
import { testSlug } from '../fixtures/testSlug'
import { cleanupTrackedUsers, createPlatformTestUser } from '../fixtures/testUsers'

describe('MCP Post drafts', () => {
  let payload: Payload
  let ownerId: number
  const staffIds: Array<number | string> = []
  const keys: number[] = []
  const posts: number[] = []
  const images: number[] = []
  const categories: number[] = []
  const tags: number[] = []
  const prefix = testSlug('mcpPostDrafts.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const owner = await createPlatformTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    ownerId = owner.id
  })

  afterAll(async () => {
    if (!payload) return
    await cleanupTrackedDocs(payload, [
      { collection: 'posts', ids: posts },
      { collection: 'platformContentMedia', ids: images },
      { collection: 'categories', ids: categories },
      { collection: 'tags', ids: tags },
      { collection: 'payload-mcp-api-keys', ids: keys },
    ])
    await cleanupTrackedUsers(payload, { staffIds })
    await payload.destroy()
  })

  async function createKey(grants: PayloadMcpApiKey['posts']) {
    const apiKey = randomUUID()
    const key = await payload.create({
      collection: 'payload-mcp-api-keys',
      data: { enableAPIKey: true, apiKey, user: ownerId, posts: grants },
    })
    keys.push(key.id)
    return apiKey
  }

  async function callMcp(apiKey: string, method: string, params?: Record<string, unknown>) {
    const endpoint = payload.config.endpoints.find((entry) => entry.path === '/mcp' && entry.method === 'post')
    if (!endpoint) throw new Error('Expected the MCP POST endpoint')
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const req = await createLocalReq(
      { req: { method: request.method, url: request.url, headers: request.headers, body: request.body } },
      payload,
    )
    const response = await endpoint.handler(req)
    expect(response.status).toBe(200)
    const text = await response.text()
    const event = text.split('\n').find((line) => line.startsWith('data:'))
    return JSON.parse(event ? event.slice(5) : text)
  }

  function callTool(apiKey: string, name: string, args: Record<string, unknown>) {
    return callMcp(apiKey, 'tools/call', { name, arguments: args })
  }

  async function save(apiKey: string, name: 'createPostDraft' | 'updatePostDraft', args: Record<string, unknown>) {
    const response = await callTool(apiKey, name, args)
    expect(response.error).toBeUndefined()
    expect(response.result?.isError, response.result?.content?.[0]?.text).not.toBe(true)
    return JSON.parse(response.result.content[0].text)
  }

  async function publish(apiKey: string, id: number, locale: 'de' | 'en', dryRun?: boolean) {
    const response = await callTool(apiKey, 'publishPost', { id, locale, dryRun })
    expect(response.error).toBeUndefined()
    expect(response.result?.isError, response.result?.content?.[0]?.text).not.toBe(true)
    return JSON.parse(response.result.content[0].text)
  }

  it('starts a German draft using the existing create grant and reports missing English', async () => {
    const key = await createKey({ create: true })
    const title = 'Deutscher Artikel'
    const slug = `${prefix}-german`
    const created = await save(key, 'createPostDraft', {
      locale: 'de',
      data: { title, slug, content: buildRichText('Deutscher Inhalt'), excerpt: 'Kurze Zusammenfassung' },
    })
    posts.push(created.id)

    expect(created).toMatchObject({ locale: 'de', status: 'draft', advisories: ['missing_english'] })
    await expect(
      payload.findByID({ collection: 'posts', id: created.id, locale: 'de', fallbackLocale: false, draft: true }),
    ).resolves.toMatchObject({ title, slug, _status: 'draft' })
    const publicPosts = await payload.find({
      collection: 'posts',
      locale: 'de',
      fallbackLocale: false,
      overrideAccess: false,
      where: { id: { equals: created.id } },
    })
    expect(publicPosts.docs).toEqual([])
  })

  it('checks both drafts before publishing each language to its public detail, list and sitemap', async () => {
    const key = await createKey({ create: true, update: true })
    const de = {
      title: 'Deutscher Artikel zur Veröffentlichung',
      slug: `${prefix}-publish-de`,
      excerpt: 'Deutsche Zusammenfassung',
      content: buildRichText('Deutscher Entwurf'),
    }
    const en = {
      title: 'English article for publication',
      slug: `${prefix}-publish-en`,
      excerpt: 'English summary',
      content: buildRichText('English draft'),
    }
    const { id } = await save(key, 'createPostDraft', { locale: 'de', data: de })
    posts.push(id)
    await save(key, 'updatePostDraft', { id, locale: 'en', data: en })

    const publicList = (locale: 'de' | 'en') =>
      findPublishedPostsPage(payload, { contentLocale: { locale }, where: { id: { equals: id } } })
    const sitemap = async (locale: 'de' | 'en') =>
      (await findPostSitemapDocs(payload, locale)).filter((doc) => doc.id === id)
    vi.mocked(revalidateTag).mockClear()
    vi.mocked(revalidatePath).mockClear()
    await expect(publish(key, id, 'de', true)).resolves.toMatchObject({ id, locale: 'de', status: 'ready' })
    await expect(publish(key, id, 'en', true)).resolves.toMatchObject({ id, locale: 'en', status: 'ready' })
    await expect(findPublicPostRoute(payload, de.slug, 'de')).resolves.toBeNull()
    await expect(findPublicPostRoute(payload, en.slug, 'en')).resolves.toBeNull()
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()

    await expect(publish(key, id, 'de')).resolves.toMatchObject({ id, locale: 'de', status: 'published' })
    await expect(findPublicPostRoute(payload, de.slug, 'de')).resolves.toMatchObject({
      post: { id, ...de },
      canonicalPath: `/posts/${de.slug}`,
    })
    await expect(publicList('de')).resolves.toMatchObject({ docs: [{ id, title: de.title, slug: de.slug }] })
    await expect(sitemap('de')).resolves.toMatchObject([{ id, slug: de.slug }])
    await expect(findPublicPostRoute(payload, en.slug, 'en')).resolves.toBeNull()
    await expect(publicList('en')).resolves.toMatchObject({ docs: [] })
    await expect(sitemap('en')).resolves.toEqual([])
    await expect(
      payload.findByID({ collection: 'posts', id, locale: 'en', fallbackLocale: false, draft: true, depth: 0 }),
    ).resolves.toMatchObject({ ...en, _status: 'draft' })
    expect(vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)).toEqual(
      expect.arrayContaining(['surface:posts-list', 'surface:sitemap:posts']),
    )
    const paths = vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
    expect(paths).toContain(`/posts/${de.slug}`)
    expect(paths).not.toContain(`/en/posts/${en.slug}`)

    vi.mocked(revalidatePath).mockClear()
    await expect(publish(key, id, 'en')).resolves.toMatchObject({ id, locale: 'en', status: 'published' })
    await expect(findPublicPostRoute(payload, en.slug, 'en')).resolves.toMatchObject({
      post: { id, ...en },
      canonicalPath: `/en/posts/${en.slug}`,
    })
    await expect(publicList('en')).resolves.toMatchObject({ docs: [{ id, title: en.title, slug: en.slug }] })
    await expect(sitemap('en')).resolves.toMatchObject([{ id, slug: en.slug }])
    await expect(findPublicPostRoute(payload, de.slug, 'de')).resolves.toMatchObject({ post: { id, ...de } })
    expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toContain(`/en/posts/${en.slug}`)
  })

  it('requires an explicit locale and Post update access, and publishes German when English is missing', async () => {
    const createKeyOnly = await createKey({ create: true })
    const updateKey = await createKey({ update: true })
    const slug = `${prefix}-publish-missing-english`
    const { id } = await save(createKeyOnly, 'createPostDraft', {
      locale: 'de',
      data: {
        title: 'Artikel ohne Übersetzung',
        slug,
        excerpt: 'Deutsche Zusammenfassung',
        content: buildRichText('Deutscher Entwurf'),
      },
    })
    posts.push(id)

    for (const [key, args] of [
      [createKeyOnly, { id, locale: 'de' }],
      [updateKey, { id }],
      [updateKey, { id, locale: 'all' }],
    ] as const) {
      const response = await callTool(key, 'publishPost', args)
      expect(Boolean(response.error || response.result?.isError)).toBe(true)
    }
    await expect(publish(updateKey, id, 'en', true)).resolves.toMatchObject({
      id,
      locale: 'en',
      status: 'missing_draft',
    })
    await expect(publish(updateKey, id, 'en')).resolves.toMatchObject({ id, locale: 'en', status: 'missing_draft' })
    await expect(findPublicPostRoute(payload, slug, 'de')).resolves.toBeNull()
    await expect(publish(updateKey, id, 'de')).resolves.toEqual({
      id,
      locale: 'de',
      status: 'published',
      advisories: ['missing_english'],
    })
    await expect(publish(updateKey, id, 'de')).resolves.toMatchObject({ id, locale: 'de', status: 'already_published' })
    await expect(findPublicPostRoute(payload, slug, 'de')).resolves.toMatchObject({ post: { id, slug } })
    await expect(findPublicPostRoute(payload, slug, 'en')).resolves.toBeNull()
  })

  it('leaves the first publication in place when the other draft fails native validation', async () => {
    const key = await createKey({ create: true, update: true })
    const deSlug = `${prefix}-publish-complete`
    const enSlug = `${prefix}-publish-incomplete`
    const { id } = await save(key, 'createPostDraft', {
      locale: 'de',
      data: {
        title: 'Vollständiger deutscher Artikel',
        slug: deSlug,
        excerpt: 'Deutsche Zusammenfassung',
        content: buildRichText('Deutscher Entwurf'),
      },
    })
    posts.push(id)
    await save(key, 'updatePostDraft', { id, locale: 'en', data: { title: 'Incomplete article', slug: enSlug } })
    await expect(publish(key, id, 'de', true)).resolves.toMatchObject({ id, locale: 'de', status: 'ready' })
    await expect(publish(key, id, 'en', true)).resolves.toMatchObject({ id, locale: 'en', status: 'ready' })

    await expect(publish(key, id, 'de')).resolves.toMatchObject({ id, locale: 'de', status: 'published' })
    const response = await callTool(key, 'publishPost', { id, locale: 'en' })
    expect(Boolean(response.error || response.result?.isError)).toBe(true)
    await expect(findPublicPostRoute(payload, deSlug, 'de')).resolves.toMatchObject({ post: { id, slug: deSlug } })
    await expect(findPublicPostRoute(payload, enSlug, 'en')).resolves.toBeNull()
    await expect(publish(key, id, 'en', true)).resolves.toMatchObject({ id, locale: 'en', status: 'ready' })
  })

  it('adds English on the same Post and keeps German draft content and the previous public German version', async () => {
    const key = await createKey({ update: true })
    const germanSlug = `${prefix}-previous-german`
    const germanTitle = 'Veröffentlichter Artikel'
    const german = await payload.create({
      collection: 'posts',
      data: {
        title: germanTitle,
        slug: germanSlug,
        excerpt: 'Veröffentlichte Zusammenfassung',
        content: buildRichText('Veröffentlichter Text'),
        _status: 'published',
      },
      locale: 'de',
      context: { disableRevalidate: true },
    })
    posts.push(german.id)
    vi.mocked(revalidateTag).mockClear()
    vi.mocked(revalidatePath).mockClear()

    const revisedTitle = 'Deutscher Entwurf'
    const germanDraft = await save(key, 'updatePostDraft', {
      id: german.id,
      locale: 'de',
      data: { title: revisedTitle },
    })
    expect(germanDraft).toEqual({ id: german.id, locale: 'de', status: 'draft', advisories: ['missing_english'] })

    const english = {
      title: 'English draft',
      slug: `${prefix}-english`,
      excerpt: 'English summary',
      content: buildRichText('English text'),
    }
    const englishDraft = await save(key, 'updatePostDraft', { id: german.id, locale: 'en', data: english })
    expect(englishDraft).toEqual({ id: german.id, locale: 'en', status: 'draft', advisories: [] })

    const revisedSummary = 'Neue Zusammenfassung'
    const secondGermanDraft = await save(key, 'updatePostDraft', {
      id: german.id,
      locale: 'de',
      data: { excerpt: revisedSummary },
    })
    expect(secondGermanDraft).toEqual({ id: german.id, locale: 'de', status: 'draft', advisories: [] })

    const readDraft = (locale: 'de' | 'en') =>
      payload.findByID({ collection: 'posts', id: german.id, locale, fallbackLocale: false, draft: true, depth: 0 })
    await expect(readDraft('de')).resolves.toMatchObject({
      title: revisedTitle,
      excerpt: revisedSummary,
      content: german.content,
      slug: germanSlug,
      _status: 'draft',
    })
    await expect(readDraft('en')).resolves.toMatchObject({ ...english, _status: 'draft' })
    await expect(findPublicPostRoute(payload, germanSlug, 'de')).resolves.toMatchObject({
      post: { id: german.id, title: germanTitle, excerpt: german.excerpt },
    })
    await expect(findPublicPostRoute(payload, english.slug, 'en')).resolves.toBeNull()
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('attaches accessible existing references without granting permission to change them', async () => {
    const key = await createKey({ create: true, update: true })
    const fixture = { context: { disableRevalidate: true } }
    const category = await payload.create({
      ...fixture,
      collection: 'categories',
      data: { title: 'Outline', slug: `${prefix}-outline` },
    })
    categories.push(category.id)
    const tag = await payload.create({
      ...fixture,
      collection: 'tags',
      data: { name: 'Advice', slug: `${prefix}-advice` },
    })
    tags.push(tag.id)
    const image = await payload.create({
      ...fixture,
      collection: 'platformContentMedia',
      data: { alt: 'Waiting room', createdBy: ownerId } as PlatformContentMedia,
      file: createTinyPngFile(`${prefix}-waiting-room.png`),
    })
    images.push(image.id)

    const de = await save(key, 'createPostDraft', {
      locale: 'de',
      data: {
        title: 'Mit bestehenden Referenzen',
        slug: `${prefix}-attachments`,
        heroImage: image.id,
        categories: [category.id],
        tags: [tag.id],
        authors: [ownerId],
      },
    })
    posts.push(de.id)
    const en = await save(key, 'updatePostDraft', {
      id: de.id,
      locale: 'en',
      data: { title: 'With existing references' },
    })
    expect(en.id).toBe(de.id)

    const tools = await callMcp(key, 'tools/list')
    const names: string[] = tools.result.tools.map(({ name }: { name: string }) => name)
    expect(names).not.toContain('updateCategories')
    expect(names).not.toContain('updateTags')
    await expect(
      payload.findByID({ collection: 'posts', id: de.id, locale: 'en', draft: true, fallbackLocale: false, depth: 0 }),
    ).resolves.toMatchObject({
      title: 'With existing references',
      heroImage: image.id,
      categories: [category.id],
      tags: [tag.id],
      authors: [ownerId],
    })
  })

  it.each([
    [{ find: true }, ['findPosts'], ['createPostDraft', 'updatePostDraft', 'publishPost']],
    [{ create: true }, ['createPosts', 'createPostDraft'], ['updatePostDraft', 'publishPost']],
    [{ update: true }, ['updatePosts', 'updatePostDraft', 'publishPost'], ['createPostDraft']],
  ] satisfies Array<[PayloadMcpApiKey['posts'], string[], string[]]>)(
    'keeps each draft tool tied to its existing Post grant (%j)',
    async (grants, available, denied) => {
      const key = await createKey(grants)
      const response = await callMcp(key, 'tools/list')
      const names: string[] = response.result.tools.map(({ name }: { name: string }) => name)
      expect(names).toEqual(expect.arrayContaining(available))
      for (const name of denied) expect(names).not.toContain(name)
    },
  )

  it('rejects an English-first draft, publication controls and unavailable attachments', async () => {
    const key = await createKey({ create: true })
    const slug = `${prefix}-invalid`
    const data = { title: 'Test article', slug }
    for (const args of [
      { locale: 'en', data },
      { locale: 'de', data: { ...data, _status: 'published' } },
      { locale: 'de', data: { ...data, heroImage: 2147483647 } },
    ]) {
      const response = await callTool(key, 'createPostDraft', args)
      expect(Boolean(response.error || response.result?.isError)).toBe(true)
    }
    const result = await payload.find({
      collection: 'posts',
      draft: true,
      locale: 'all',
      fallbackLocale: false,
      where: { slug: { equals: slug } },
    })
    expect(result.docs).toEqual([])
  })
})
