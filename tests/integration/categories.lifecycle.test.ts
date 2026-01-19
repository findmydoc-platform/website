import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'
import type { Category } from '@/payload-types'

describe('Categories integration - lifecycle and access', () => {
  let payload: Payload
  const slugPrefix = slugify(testSlug('categories.lifecycle.test.ts'))

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'categories', slugPrefix)
  })

  it('creates a category and generates slug from title', async () => {
    const title = `${slugPrefix} alpha`

    const created = await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    expect(created).toBeDefined()
    expect(created.title).toBe(title)
    expect(created.slug).toBe(slugify(title))
  })

  it('rejects duplicate category slug/title (unique constraint)', async () => {
    const title = `${slugPrefix} duplicate`

    await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    await expect(async () => {
      await payload.create({
        collection: 'categories',
        data: { title } as unknown as Category,
        draft: false,
        overrideAccess: true,
      })
    }).rejects.toThrowError(/slug|unique|duplicate|violates|constraint|categories_slug_idx/i)
  })

  it('updates title without changing slug unless explicitly set', async () => {
    const title = `${slugPrefix} slug lock`

    const created = await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    const updatedTitle = `${slugPrefix} slug lock updated`
    const afterTitleUpdate = await payload.update({
      collection: 'categories',
      id: created.id,
      data: { title: updatedTitle } as unknown as Category,
      overrideAccess: true,
    })

    expect(afterTitleUpdate.title).toBe(updatedTitle)
    expect(afterTitleUpdate.slug).toBe(created.slug)

    const explicitSlug = `${slugPrefix}-explicit`
    const afterSlugUpdate = await payload.update({
      collection: 'categories',
      id: created.id,
      data: { slug: explicitSlug } as unknown as Category,
      overrideAccess: true,
    })

    expect(afterSlugUpdate.slug).toBe(explicitSlug)
  })

  it('deletes a category and removes it from queries', async () => {
    const title = `${slugPrefix} delete me`

    const created = await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    const deleted = await payload.delete({
      collection: 'categories',
      id: created.id,
      overrideAccess: true,
    })

    expect(deleted).toBeDefined()

    const findResult = await payload.find({
      collection: 'categories',
      where: { id: { equals: created.id } },
      overrideAccess: true,
    })

    expect(findResult.docs).toHaveLength(0)

    await expect(
      payload.findByID({
        collection: 'categories',
        id: created.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('rejects missing title', async () => {
    await expect(
      payload.create({
        collection: 'categories',
        data: {},
        draft: false,
        overrideAccess: true,
      } as unknown as Parameters<Payload['create']>[0]),
    ).rejects.toThrow()
  })

  it('allows public read but blocks unauthenticated create', async () => {
    const title = `${slugPrefix} public-read`

    const created = await payload.create({
      collection: 'categories',
      data: { title } as unknown as Category,
      draft: false,
      overrideAccess: true,
    })

    const publicRead = await payload.find({
      collection: 'categories',
      where: { id: { equals: created.id } },
      overrideAccess: false,
    })

    expect(publicRead.docs).toHaveLength(1)
    expect(publicRead.docs[0]?.title).toBe(title)

    await expect(async () => {
      await payload.create({
        collection: 'categories',
        data: { title: `${slugPrefix} should-fail` } as unknown as Category,
        draft: false,
        overrideAccess: false,
      })
    }).rejects.toThrow()
  })
})
