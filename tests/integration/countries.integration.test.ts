import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'

describe('Countries integration', () => {
  let payload: Payload
  const slugPrefix = testSlug('countries.integration.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    const { docs } = await payload.find({
      collection: 'countries',
      where: { name: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'countries', id: doc.id, overrideAccess: true })
    }
  })

  it('creates and updates a country', async () => {
    const country = await payload.create({
      collection: 'countries',
      data: {
        name: `${slugPrefix}-Country`,
        isoCode: 'TC',
        language: 'Testish',
        currency: 'TST',
      },
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'countries',
      id: country.id,
      data: {
        currency: 'TSC',
      },
      overrideAccess: true,
    })

    expect(updated.currency).toBe('TSC')
  })

  it('rejects missing required fields', async () => {
    await expect(
      payload.create({
        collection: 'countries',
        data: { name: `${slugPrefix}-Invalid` },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
