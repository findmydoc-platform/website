import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import type { ContentBlock } from '@/payload-types'

const buildPageLayout = (): ContentBlock[] => [
  {
    blockType: 'content',
    columns: [],
  },
]

async function findPage(payload: Payload, slug: string) {
  const result = await payload.find({
    collection: 'pages',
    where: {
      slug: {
        equals: slug,
      },
    },
    limit: 1,
    pagination: false,
    overrideAccess: true,
    trash: true,
  })

  return result.docs[0] ?? null
}

describe('Pages integration - managed legal pages', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  it('ensures required legal pages exist and are published', async () => {
    const privacyPage = await findPage(payload, 'privacy-policy')
    const imprintPage = await findPage(payload, 'imprint')

    expect(privacyPage).toBeTruthy()
    expect(imprintPage).toBeTruthy()
    expect(privacyPage?._status).toBe('published')
    expect(imprintPage?._status).toBe('published')
  })

  it('blocks unpublishing a required legal page', async () => {
    const privacyPage = await findPage(payload, 'privacy-policy')
    expect(privacyPage).toBeTruthy()

    await expect(
      payload.update({
        collection: 'pages',
        id: privacyPage!.id,
        data: {
          _status: 'draft',
        },
        overrideAccess: true,
        context: { disableRevalidate: true },
      }),
    ).rejects.toThrow('Privacy Policy must remain published')
  })

  it('blocks changing the slug of a required legal page', async () => {
    const imprintPage = await findPage(payload, 'imprint')
    expect(imprintPage).toBeTruthy()

    await expect(
      payload.update({
        collection: 'pages',
        id: imprintPage!.id,
        data: {
          slug: 'impressum',
        },
        overrideAccess: true,
        context: { disableRevalidate: true },
      }),
    ).rejects.toThrow('Imprint must keep the slug "imprint"')
  })

  it('allows content updates on a required legal page', async () => {
    const privacyPage = await findPage(payload, 'privacy-policy')
    expect(privacyPage).toBeTruthy()

    const updated = await payload.update({
      collection: 'pages',
      id: privacyPage!.id,
      data: {
        title: 'Privacy Policy',
        layout: buildPageLayout(),
      },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    expect(updated.slug).toBe('privacy-policy')
    expect(updated.layout).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockType: 'content',
          columns: [],
        }),
      ]),
    )
  })

  it('blocks deleting a required legal page', async () => {
    const imprintPage = await findPage(payload, 'imprint')
    expect(imprintPage).toBeTruthy()

    await expect(
      payload.delete({
        collection: 'pages',
        id: imprintPage!.id,
        overrideAccess: true,
        context: { disableRevalidate: true },
      }),
    ).rejects.toThrow('Imprint is a required legal page and cannot be deleted')
  })

  it('creates and maintains the legacy privacy redirect', async () => {
    const redirects = await payload.find({
      collection: 'redirects',
      where: {
        from: {
          equals: '/privacy',
        },
      },
      limit: 5,
      pagination: false,
      overrideAccess: true,
    })

    expect(redirects.docs).toHaveLength(1)
    expect(redirects.docs[0]?.to?.type).toBe('custom')
    expect(redirects.docs[0]?.to?.url).toBe('/privacy-policy')
  })

  it('does not keep a legacy terms redirect', async () => {
    const redirects = await payload.find({
      collection: 'redirects',
      where: {
        from: {
          equals: '/terms',
        },
      },
      limit: 5,
      pagination: false,
      overrideAccess: true,
    })

    expect(redirects.docs).toHaveLength(0)
  })
})
