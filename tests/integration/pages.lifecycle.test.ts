import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { buildRichText } from '../fixtures/richText'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'
import { findPageBySlug, findPublicPageRoute } from '@/utilities/content/serverData'
import type { ContentBlock } from '@/payload-types'

const buildPageLayout = (text = 'Page content for integration tests.'): ContentBlock[] => [
  {
    blockType: 'content',
    columns: [
      {
        size: 'full',
        richText: buildRichText(text),
      },
    ],
  },
]

describe('Pages integration - lifecycle and access', () => {
  let payload: Payload
  const slugPrefix = slugify(testSlug('pages.lifecycle.test.ts'))

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'pages', slugPrefix)
  })

  it('creates a draft page and generates slug from title', async () => {
    const title = `${slugPrefix} draft page`

    const created = await payload.create({
      collection: 'pages',
      data: {
        title,
        layout: buildPageLayout(),
        _status: 'draft',
      },
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    expect(created).toBeDefined()
    expect(created.title).toBe(title)
    expect(created.slug).toBe(slugify(title))
    expect(created._status).toBe('draft')
  })

  it('publishes a page and auto-populates publishedAt when missing', async () => {
    const title = `${slugPrefix} publish page`

    const created = await payload.create({
      collection: 'pages',
      data: {
        title,
        layout: buildPageLayout(),
        _status: 'draft',
      },
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const updated = await payload.update({
      collection: 'pages',
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

  it.each(['active', 'all'] as const)(
    'publishes the selected Page languages using the %s publication action',
    async (publicationScope) => {
      expect(payload.config.localization && payload.config.localization.defaultLocalePublishOption).toBe('active')

      const germanSlug = `${slugPrefix}-de`
      const englishSlug = `${slugPrefix}-en`
      const germanTitle = 'Test page in German'
      const englishTitle = 'Test page in English'
      const created = await payload.create({
        collection: 'pages',
        locale: 'de',
        data: {
          title: germanTitle,
          slug: germanSlug,
          generateSlug: false,
          layout: buildPageLayout('German page content.'),
          _status: 'draft',
        },
        draft: true,
        context: { disableRevalidate: true },
      })

      await payload.update({
        collection: 'pages',
        id: created.id,
        locale: 'en',
        data: {
          title: englishTitle,
          slug: englishSlug,
          generateSlug: false,
          layout: buildPageLayout('English page content.'),
          meta: { description: 'English SEO description.' },
        },
        draft: true,
        context: { disableRevalidate: true },
      })

      await payload.update({
        collection: 'pages',
        id: created.id,
        locale: 'de',
        publishSpecificLocale: 'de',
        data: { _status: 'published' },
        context: { disableRevalidate: true },
      })

      const germanPage = await findPageBySlug(payload, germanSlug, false, { locale: 'de', fallbackLocale: false })
      expect(germanPage).toMatchObject({ id: created.id, title: germanTitle, slug: germanSlug })
      expect(germanPage?.meta?.description).toBeFalsy()
      expect(await findPublicPageRoute(payload, englishSlug, 'en')).toBeNull()
      const germanAPIRead = await payload.find({
        collection: 'pages',
        locale: 'de',
        fallbackLocale: 'en',
        overrideAccess: false,
        where: { id: { equals: created.id } },
      })
      expect(germanAPIRead.docs[0]?.meta?.description).toBeFalsy()
      const allLocalesAPIRead = await payload.find({
        collection: 'pages',
        locale: 'all',
        overrideAccess: false,
        disableErrors: true,
        where: { id: { equals: created.id } },
      })
      expect(allLocalesAPIRead.docs).toEqual([])
      const germanRoute = await findPublicPageRoute(payload, germanSlug, 'de')
      expect(germanRoute).toMatchObject({ canonicalPath: `/${germanSlug}` })
      expect(germanRoute?.languagePaths).toBeUndefined()

      await payload.update({
        collection: 'pages',
        id: created.id,
        locale: 'en',
        ...(publicationScope === 'all' ? { publishAllLocales: true } : { publishSpecificLocale: 'en' }),
        data: { _status: 'published' },
        context: { disableRevalidate: true },
      })

      const englishPage = await findPageBySlug(payload, englishSlug, false, { locale: 'en', fallbackLocale: false })
      expect(englishPage).toMatchObject({
        id: created.id,
        title: englishTitle,
        slug: englishSlug,
        meta: { description: 'English SEO description.' },
      })
      expect(JSON.stringify(englishPage?.layout)).toContain('English page content.')
      const languagePaths = { de: `/${germanSlug}`, en: `/en/${englishSlug}`, 'x-default': `/${germanSlug}` }
      expect(await findPublicPageRoute(payload, germanSlug, 'de')).toMatchObject({
        canonicalPath: `/${germanSlug}`,
        languagePaths,
      })
      expect(await findPublicPageRoute(payload, englishSlug, 'en')).toMatchObject({
        canonicalPath: `/en/${englishSlug}`,
        languagePaths,
      })
      expect(await findPageBySlug(payload, germanSlug, false, { locale: 'de', fallbackLocale: false })).toMatchObject({
        id: created.id,
        title: germanTitle,
        slug: germanSlug,
      })
      await payload.update({
        collection: 'pages',
        id: created.id,
        locale: 'en',
        data: { _status: 'draft' },
        context: { disableRevalidate: true },
      })
      expect(await findPublicPageRoute(payload, englishSlug, 'en')).toBeNull()
      expect(await findPublicPageRoute(payload, germanSlug, 'de')).toMatchObject({ canonicalPath: `/${germanSlug}` })
    },
  )

  it('updates title without changing slug unless explicitly set', async () => {
    const title = `${slugPrefix} slug lock`

    const created = await payload.create({
      collection: 'pages',
      data: {
        title,
        layout: buildPageLayout(),
        _status: 'draft',
      },
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const updatedTitle = `${slugPrefix} slug lock updated`
    const afterTitleUpdate = await payload.update({
      collection: 'pages',
      id: created.id,
      data: {
        title: updatedTitle,
      },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    expect(afterTitleUpdate.title).toBe(updatedTitle)
    expect(afterTitleUpdate.slug).toBe(created.slug)

    const explicitSlug = `${slugPrefix}-explicit`
    const afterSlugUpdate = await payload.update({
      collection: 'pages',
      id: created.id,
      data: {
        slug: explicitSlug,
      },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    expect(afterSlugUpdate.slug).toBe(explicitSlug)
  })

  it('soft deletes a page (trash functionality)', async () => {
    const title = `${slugPrefix} trash page`

    const created = await payload.create({
      collection: 'pages',
      data: {
        title,
        layout: buildPageLayout(),
        _status: 'draft',
      },
      draft: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const deleted = await payload.delete({
      collection: 'pages',
      id: created.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    expect(deleted).toBeDefined()

    const findResult = await payload.find({
      collection: 'pages',
      where: { id: { equals: created.id } },
      overrideAccess: true,
    })

    expect(findResult.docs).toHaveLength(0)

    await expect(
      payload.findByID({
        collection: 'pages',
        id: created.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('allows public read for published pages but blocks unauthenticated create', async () => {
    const title = `${slugPrefix} public read`

    const created = await payload.create({
      collection: 'pages',
      data: {
        title,
        layout: buildPageLayout(),
        _status: 'draft',
      },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    await payload.update({
      collection: 'pages',
      id: created.id,
      data: { _status: 'published' },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    const publicRead = await payload.find({
      collection: 'pages',
      where: { id: { equals: created.id } },
      overrideAccess: false,
    })

    expect(publicRead.docs).toHaveLength(1)
    expect(publicRead.docs[0]?.title).toBe(title)

    await expect(
      payload.create({
        collection: 'pages',
        data: {
          title: `${slugPrefix} should-fail`,
          layout: buildPageLayout(),
          _status: 'draft',
        },
        draft: true,
        overrideAccess: false,
        context: { disableRevalidate: true },
      }),
    ).rejects.toThrow()
  })

  it('keeps a managed legal page public while its draft is available for preview', async () => {
    const slug = 'privacy-policy'
    const english = { locale: 'en', fallbackLocale: false } as const
    const publishedBefore = await findPageBySlug(payload, slug, false, english)

    if (!publishedBefore) {
      throw new Error('Expected the managed privacy policy page to be published')
    }

    expect(await findPublicPageRoute(payload, slug, 'de')).toMatchObject({
      page: { id: publishedBefore.id },
      locale: 'en',
      canonicalPath: '/en/privacy-policy',
    })

    const draftMarker = 'Managed legal page draft preview content.'

    try {
      await payload.update({
        collection: 'pages',
        locale: 'en',
        id: publishedBefore.id,
        data: {
          layout: buildPageLayout(draftMarker),
          _status: 'draft',
        },
        autosave: true,
        draft: true,
        overrideAccess: true,
      })

      const [publicPage, previewPage] = await Promise.all([
        findPageBySlug(payload, slug, false, english),
        findPageBySlug(payload, slug, true, english),
      ])

      expect(publicPage?.layout).toEqual(publishedBefore.layout)
      expect(JSON.stringify(previewPage?.layout)).toContain(draftMarker)

      await expect(
        payload.update({
          collection: 'pages',
          locale: 'en',
          id: publishedBefore.id,
          data: { _status: 'draft' },
          unpublishAllLocales: true,
          overrideAccess: true,
          context: { disableRevalidate: true },
        }),
      ).rejects.toThrow('Privacy Policy must remain published')
    } finally {
      await payload.update({
        collection: 'pages',
        locale: 'en',
        id: publishedBefore.id,
        data: {
          layout: publishedBefore.layout,
          _status: 'published',
        },
        draft: false,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
    }
  })

  it('rejects missing title', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        data: {
          layout: buildPageLayout(),
          _status: 'published',
        },
        draft: false,
        overrideAccess: true,
        context: { disableRevalidate: true },
      } as unknown as Parameters<Payload['create']>[0]),
    ).rejects.toThrow()
  })
})
