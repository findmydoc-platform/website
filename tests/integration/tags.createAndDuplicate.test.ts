import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'

describe('Tags integration - create and duplicate behavior', () => {
  let payload: Payload
  const slugPrefix = slugify(testSlug('tags.createAndDuplicate.test.ts'))

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'tags', slugPrefix)
  })

  it('creates tags and attempts a duplicate (accept success or expected validation error)', async () => {
    const nameA = `${slugPrefix} alpha`
    const nameB = `${slugPrefix} beta`
    const nameDup = `${slugPrefix} alpha` // same as nameA

    // create first tag
    const a = await payload.create({ collection: 'tags', data: { name: nameA } as any, overrideAccess: true })
    expect(a).toBeDefined()
    expect(a.slug).toBe(slugify(nameA))

    // create second tag with a different name
    const b = await payload.create({ collection: 'tags', data: { name: nameB } as any, overrideAccess: true })
    expect(b).toBeDefined()
    expect(b.slug).toBe(slugify(nameB))

    // attempt to create duplicate - for now we expect this to fail with a slug/unique constraint error
    await expect(async () => {
      await payload.create({ collection: 'tags', data: { name: nameDup } as any, overrideAccess: true })
    }).rejects.toThrowError(/slug|unique|duplicate|violates|constraint|tags_slug_idx/i)
  })
})
