import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'
import type { ContentBlock } from '@/payload-types'

const buildPageLayout = (): ContentBlock[] => [
  {
    blockType: 'content',
    columns: [],
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
