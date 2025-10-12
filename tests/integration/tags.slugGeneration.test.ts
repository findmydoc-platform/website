import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'

describe('Tags collection integration', () => {
  let payload: Payload
  const slugPrefix = slugify(testSlug('tags.slugGeneration.test.ts'))

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'tags', slugPrefix)
  })

  it('auto-generates slug from the provided name', async () => {
    const name = `${slugPrefix} primary`

    const created = await payload.create({
      collection: 'tags',
      data: { name },
      overrideAccess: true,
    })

    expect(created.name).toBe(name)
    expect(created.slug).toBe(slugify(name))
  })

  it('appends a unique suffix when creating a duplicate name', async () => {
    const name = `${slugPrefix} duplicate`
    const baseSlug = slugify(name)

    const first = await payload.create({
      collection: 'tags',
      data: { name },
      overrideAccess: true,
    })

    const second = await payload.create({
      collection: 'tags',
      data: { name },
      overrideAccess: true,
    })

    expect(first.slug).toBe(baseSlug)
    expect(second.slug).not.toBe(baseSlug)
    expect(second.slug).toMatch(new RegExp(`^${baseSlug}-\\d+$`))
  })
})
