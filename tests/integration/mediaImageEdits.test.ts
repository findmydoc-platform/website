import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { S3 } from '@aws-sdk/client-s3'
import {
  getPayload,
  handleEndpoints,
  type CollectionBeforeChangeHook,
  type Payload,
  type PayloadRequest,
} from 'payload'
import config from '@payload-config'
import type { PlatformContentMedia } from '@/payload-types'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'

describe('media image editing through Payload and cloud storage', () => {
  let payload: Payload
  let user: NonNullable<PayloadRequest['user']>
  let previousSkipSafeFetch: unknown
  const mediaIds: number[] = []
  const staffIds: number[] = []
  const fileReads: string[] = []
  const transport = globalThis.fetch

  beforeAll(async () => {
    payload = await getPayload({ config })
    const upload = payload.collections.platformContentMedia.config.upload
    previousSkipSafeFetch = upload.skipSafeFetch
    upload.skipSafeFetch = true
    const staff = await payload.create({
      collection: 'platformStaff',
      data: {
        email: `media-edit-${randomUUID()}@example.com`,
        supabaseUserId: randomUUID(),
        firstName: 'Media',
        lastName: 'Editor',
        role: 'support',
      },
      context: { trustedPlatformStaffOps: true },
    })
    staffIds.push(staff.id)
    user = { ...staff, collection: 'platformStaff' }
    // Route only the in-process application's HTTP boundary to the real REST handler.
    // S3 and Postgres use the repository's isolated integration services.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.startsWith('https://media-edit.example/')) {
        fileReads.push(url)
        return handleEndpoints({ config, request: new Request(url, init) })
      }
      return transport(input, init)
    })
  })

  afterEach(async () => {
    await cleanupTrackedDocs(payload, [{ collection: 'platformContentMedia', ids: mediaIds }])
    fileReads.length = 0
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    if (payload) {
      payload.collections.platformContentMedia.config.upload.skipSafeFetch = previousSkipSafeFetch as boolean
      await cleanupTrackedDocs(payload, [{ collection: 'platformStaff', ids: staffIds }])
    }
  })

  const createImage = async () => {
    const data = await sharp({ create: { width: 100, height: 80, channels: 3, background: '#6688aa' } })
      .png()
      .toBuffer()
    const doc = await payload.create({
      collection: 'platformContentMedia',
      data: { alt: 'Before edit' } as PlatformContentMedia,
      file: { name: `${randomUUID()}.png`, data, size: data.length, mimetype: 'image/png' },
      user,
      overrideAccess: false,
      depth: 0,
    })
    mediaIds.push(doc.id)
    return doc
  }

  it('saves unchanged Apply without reading or replacing the image', async () => {
    const doc = await createImage()
    const updated = await payload.update({
      collection: 'platformContentMedia',
      id: doc.id,
      user,
      overrideAccess: false,
      depth: 0,
      data: { ...doc, alt: 'After edit', url: new URL(doc.url!, 'https://media-edit.example').toString() },
      req: {
        headers: new Headers({ origin: 'https://media-edit.example' }),
        query: { uploadEdits: { widthInPixels: '100', heightInPixels: '80', focalPoint: { x: '50', y: '50' } } },
      },
    })
    expect(updated.alt).toBe('After edit')
    expect(updated.filename).toBe(doc.filename)
    expect(updated.storagePath).toBe(doc.storagePath)
    expect(fileReads).toEqual([])
  })

  it('crops once and persists storage metadata without refetching an uncommitted filename', async () => {
    const doc = await createImage()
    const query = {
      locale: 'en',
      uploadEdits: {
        crop: { unit: '%', x: 0, y: 0, width: 50, height: 50 },
        widthInPixels: 50,
        heightInPixels: 40,
        focalPoint: { x: 0, y: 0 },
      },
    }
    const req = { headers: new Headers({ origin: 'https://media-edit.example' }), query }
    const updated = await payload.update({
      collection: 'platformContentMedia',
      id: doc.id,
      user,
      overrideAccess: false,
      depth: 0,
      data: { ...doc, url: new URL(doc.url!, 'https://media-edit.example').toString() },
      req,
    })
    expect(updated.width).toBe(50)
    expect(updated.height).toBe(40)
    expect(updated.focalX).toBe(0)
    expect(updated.focalY).toBe(0)
    expect(fileReads).toHaveLength(1)
    expect(req.query).toEqual(query)
    const stored = await payload.findByID({
      collection: 'platformContentMedia',
      id: doc.id,
      user,
      overrideAccess: false,
    })
    expect(stored.filename).toBe(updated.filename)
  })

  it('restores the edit query when internal metadata persistence fails', async () => {
    const doc = await createImage()
    const hooks = payload.collections.platformContentMedia.config.hooks.beforeChange
    let internalRequest: PayloadRequest | undefined
    const rejectMetadata: CollectionBeforeChangeHook = ({ req, data }) => {
      if (req.context.skipCloudStorage) {
        internalRequest = req
        expect(req.query.uploadEdits).toBeUndefined()
        expect(req.query.locale).toBe('en')
        throw new Error('Metadata persistence failed')
      }
      return data
    }
    hooks.push(rejectMetadata)
    try {
      await expect(
        payload.update({
          collection: 'platformContentMedia',
          id: doc.id,
          user,
          overrideAccess: false,
          data: { ...doc, url: new URL(doc.url!, 'https://media-edit.example').toString() },
          req: {
            headers: new Headers({ origin: 'https://media-edit.example' }),
            query: {
              locale: 'en',
              uploadEdits: {
                crop: { unit: '%', x: 0, y: 0, width: 50, height: 50 },
                widthInPixels: 50,
                heightInPixels: 40,
              },
            },
          },
        }),
      ).rejects.toThrow('Metadata persistence failed')
      expect(internalRequest?.query.uploadEdits).toEqual(
        expect.objectContaining({ widthInPixels: 50, heightInPixels: 40 }),
      )
      expect(internalRequest?.context.skipCloudStorage).toBeUndefined()
      expect(fileReads).toHaveLength(1)
      const stored = await payload.findByID({ collection: 'platformContentMedia', id: doc.id })
      expect(stored.filename).toBe(doc.filename)
    } finally {
      hooks.splice(hooks.indexOf(rejectMetadata), 1)
    }
  })

  it('propagates storage upload failures without accepting a new image', async () => {
    const doc = await createImage()
    const putObject = vi.spyOn(S3.prototype, 'putObject').mockRejectedValue(new Error('Storage unavailable'))
    try {
      const data = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#aabbcc' } })
        .png()
        .toBuffer()
      await expect(
        payload.update({
          collection: 'platformContentMedia',
          id: doc.id,
          user,
          overrideAccess: false,
          data: { alt: 'Replacement' },
          file: { name: 'replacement.png', data, mimetype: 'image/png', size: data.length },
        }),
      ).rejects.toThrow('Storage unavailable')
      const stored = await payload.findByID({ collection: 'platformContentMedia', id: doc.id })
      expect(stored.filename).toBe(doc.filename)
    } finally {
      putObject.mockRestore()
    }
  })
})
