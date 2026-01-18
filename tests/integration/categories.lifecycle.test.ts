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
