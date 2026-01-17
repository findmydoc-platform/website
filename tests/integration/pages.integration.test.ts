import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

const layoutBlock = {
  blockType: 'content',
  columns: [],
}

describe('Pages integration', () => {
  let payload: Payload
  const slugPrefix = testSlug('pages.integration.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'pages', slugPrefix)
  })

  it('creates a page and generates a slug', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        title: `${slugPrefix}-page`,
        layout: [layoutBlock],
      },
      overrideAccess: true,
    })

    expect(page.id).toBeDefined()
    expect(page.slug).toContain(`${slugPrefix}-page`)
  })

  it('auto-populates publishedAt when publishing without a date', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        title: `${slugPrefix}-publish`,
        layout: [layoutBlock],
      },
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'pages',
      id: page.id,
      data: {
        _status: 'published',
      },
      overrideAccess: true,
    })

    expect(updated.publishedAt).toBeTruthy()
  })

  it('rejects missing title', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        data: {
          layout: [layoutBlock],
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('blocks create for anonymous users', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        data: {
          title: `${slugPrefix}-no-access`,
          layout: [layoutBlock],
        },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('rejects invalid block data', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        data: {
          title: `${slugPrefix}-invalid-block`,
          layout: [{ blockType: 'content' }],
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('soft deletes a page', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        title: `${slugPrefix}-trash`,
        layout: [layoutBlock],
      },
      overrideAccess: true,
    })

    await payload.delete({
      collection: 'pages',
      id: page.id,
      overrideAccess: true,
    })

    const findResult = await payload.find({
      collection: 'pages',
      where: { id: { equals: page.id } },
      overrideAccess: true,
    })

    expect(findResult.docs).toHaveLength(0)
  })
})
