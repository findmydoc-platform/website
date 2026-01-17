import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'

describe('Categories integration', () => {
  let payload: Payload
  const slugPrefix = testSlug('categories.integration.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'categories', slugPrefix)
  })

  it('creates a category with an auto-generated slug', async () => {
    const title = `${slugPrefix} Category`
    const category = await payload.create({
      collection: 'categories',
      data: { title },
      overrideAccess: true,
    })

    expect(category.id).toBeDefined()
    expect(category.slug).toBe(slugify(title))
  })

  it('updates a category title and slug', async () => {
    const category = await payload.create({
      collection: 'categories',
      data: { title: `${slugPrefix} Original` },
      overrideAccess: true,
    })

    const updatedTitle = `${slugPrefix} Updated`
    const updated = await payload.update({
      collection: 'categories',
      id: category.id,
      data: { title: updatedTitle },
      overrideAccess: true,
    })

    expect(updated.title).toBe(updatedTitle)
    expect(updated.slug).toBe(slugify(updatedTitle))
  })

  it('rejects missing title', async () => {
    await expect(
      payload.create({
        collection: 'categories',
        data: {},
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
