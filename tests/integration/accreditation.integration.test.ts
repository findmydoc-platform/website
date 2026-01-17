import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { createPngFile } from '../fixtures/testFiles'

describe('Accreditation integration', () => {
  let payload: Payload
  const slugPrefix = testSlug('accreditation.integration.test.ts')
  const createdMediaIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    while (createdMediaIds.length) {
      const id = createdMediaIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'platformContentMedia', id, overrideAccess: true })
    }

    const { docs } = await payload.find({
      collection: 'accreditation',
      where: { name: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'accreditation', id: doc.id, overrideAccess: true })
    }
  })

  it('creates accreditation with an icon upload', async () => {
    const icon = await payload.create({
      collection: 'platformContentMedia',
      data: { alt: 'Accreditation icon' },
      file: createPngFile(`${slugPrefix}-icon.png`),
      overrideAccess: true,
    })
    createdMediaIds.push(icon.id)

    const accreditation = await payload.create({
      collection: 'accreditation',
      data: {
        name: `${slugPrefix} Accreditation`,
        abbreviation: 'ACC',
        country: 'Turkey',
        description: {
          root: {
            type: 'root',
            children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Accreditation details' }] }],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        icon: icon.id,
      },
      overrideAccess: true,
    })

    expect(accreditation.id).toBeDefined()
    expect(accreditation.icon).toBe(icon.id)
  })

  it('rejects missing required fields', async () => {
    await expect(
      payload.create({
        collection: 'accreditation',
        data: { name: `${slugPrefix}-invalid` },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
