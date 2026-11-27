import { randomUUID } from 'node:crypto'
import { createLocalReq, getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@payload-config'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { cleanupTrackedUsers, createPlatformTestUser } from '../fixtures/testUsers'

const uploadLimitBytes = 3_100_000
const mcpBodyLimitBytes = 4 * 1024 * 1024

const requestBody = (args: Record<string, unknown>, name = 'uploadEditorialImage') =>
  JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  })

const responseMessage = (body: string) => {
  const eventData = body.split('\n').find((line) => line.startsWith('data:'))
  const reply = JSON.parse(eventData ? eventData.slice(5) : body) as {
    error?: { message: string }
    result?: { isError?: boolean; content: Array<{ text: string }> }
  }
  return {
    isError: Boolean(reply.error || reply.result?.isError),
    text: reply.error?.message ?? reply.result?.content[0]?.text,
  }
}

describe('MCP editorial image upload', () => {
  let payload: Payload
  let staffId: number
  const staffIds: Array<number | string> = []
  const keyIds: number[] = []
  const mediaIds: number[] = []
  const postIds: number[] = []
  const suffix = randomUUID()
  const upload = {
    name: `editorial-${suffix}.png`,
    mimeType: 'image/png',
    alt: 'Editorial image',
    base64: createTinyPngFile('editorial-image.png').data.toString('base64'),
  }
  const grantedToken = randomUUID()
  const draftOnlyToken = randomUUID()

  beforeAll(async () => {
    payload = await getPayload({ config })
    const staff = await createPlatformTestUser(payload, {
      emailPrefix: `editorial-image-${suffix}`,
      createdStaffIds: staffIds,
    })
    staffId = staff.id
    for (const [token, grantUpload] of [
      [grantedToken, true],
      [draftOnlyToken, false],
    ] as const) {
      const key = await payload.create({
        collection: 'payload-mcp-api-keys',
        overrideAccess: true,
        data: {
          user: staffId,
          label: `Editorial image test ${suffix}`,
          enableAPIKey: true,
          apiKey: token,
          posts: { find: true, create: true, update: true },
          ...(grantUpload ? { blogMedia: { upload: true } } : {}),
        },
      })
      keyIds.push(key.id)
    }
  })

  afterAll(async () => {
    await cleanupTrackedDocs(payload, [
      { collection: 'posts', ids: postIds },
      { collection: 'platformContentMedia', ids: mediaIds },
      { collection: 'payload-mcp-api-keys', ids: keyIds },
    ])
    await cleanupTrackedUsers(payload, { staffIds })
  })

  const call = async (body: string, token = grantedToken) => {
    const endpoint = payload.config.endpoints.find(({ path, method }) => path === '/mcp' && method === 'post')
    if (!endpoint) throw new Error('Expected the MCP POST endpoint')
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body,
    })
    const req = await createLocalReq(
      { req: { method: request.method, url: request.url, headers: request.headers, body: request.body } },
      payload,
    )
    const response = await endpoint.handler(req)
    expect(response.status).toBe(200)
    return responseMessage(await response.text())
  }

  const countUploads = async () =>
    (
      await payload.count({
        collection: 'platformContentMedia',
        overrideAccess: false,
        where: { createdBy: { equals: staffId } },
      })
    ).totalDocs

  it('denies image creation for a key with only Post grants', async () => {
    const before = await countUploads()
    expect(await call(requestBody(upload), draftOnlyToken)).toMatchObject({
      isError: true,
      text: expect.stringContaining('uploadEditorialImage not found'),
    })
    expect(await countUploads()).toBe(before)
  })

  it.each([
    ['blank alt text', { alt: '  ' }, 'Enter alternative text'],
    ['invalid base64', { base64: 'not-an-image!' }, 'valid Base64'],
    ['invalid file content', { base64: Buffer.from('not an image').toString('base64') }, 'Unsupported image format'],
    ['unsupported MIME type', { mimeType: 'text/plain' }, 'Unsupported image format'],
  ])('rejects %s without creating media', async (_case, change, message) => {
    const before = await countUploads()
    expect(await call(requestBody({ ...upload, ...change }))).toMatchObject({
      isError: true,
      text: expect.stringContaining(message),
    })
    expect(await countUploads()).toBe(before)
  })

  it('rejects a file over the MCP limit even when the complete HTTP body fits', async () => {
    const before = await countUploads()
    const base64 = Buffer.alloc(uploadLimitBytes + 1).toString('base64')
    const body = requestBody({ ...upload, base64 })
    expect(Buffer.byteLength(body)).toBeLessThan(mcpBodyLimitBytes)
    expect(await call(body)).toMatchObject({ isError: true, text: expect.stringContaining('3.1 MB') })
    expect(await countUploads()).toBe(before)
  })

  it('uploads a near-limit PNG and attaches it to a Post draft without publishing', async () => {
    const post = await payload.create({
      collection: 'posts',
      data: { title: `Editorial image draft ${suffix}`, _status: 'draft' },
      draft: true,
      locale: 'de',
    })
    postIds.push(post.id)

    const image = await sharp({ create: { width: 1024, height: 1006, channels: 3, background: '#537292' } })
      .png({ compressionLevel: 0 })
      .toBuffer()
    expect(image.length).toBeGreaterThan(uploadLimitBytes - 16_384)
    expect(image.length).toBeLessThanOrEqual(uploadLimitBytes)
    const alt = 'ä'.repeat(2_000)
    const body = requestBody({ ...upload, alt, base64: image.toString('base64') })
    expect(Buffer.byteLength(body)).toBeLessThan(mcpBodyLimitBytes)

    const result = await call(body)
    expect(result).toMatchObject({ isError: false, text: expect.any(String) })
    const reference = JSON.parse(result.text!) as { id: number }
    mediaIds.push(reference.id)
    expect(
      await payload.findByID({ collection: 'platformContentMedia', id: reference.id, overrideAccess: false, depth: 0 }),
    ).toMatchObject({
      id: reference.id,
      mimeType: 'image/png',
      alt,
      createdBy: staffId,
    })

    expect(
      await call(requestBody({ id: post.id, heroImage: reference.id, draft: true, locale: 'de' }, 'updatePosts')),
    ).toMatchObject({
      isError: false,
      text: expect.stringContaining('Document updated successfully'),
    })
    expect(
      await payload.findByID({ collection: 'posts', id: post.id, draft: true, locale: 'de', depth: 0 }),
    ).toMatchObject({
      _status: 'draft',
      heroImage: reference.id,
    })
    expect(
      (
        await payload.find({
          collection: 'posts',
          where: { id: { equals: post.id } },
          locale: 'de',
          overrideAccess: false,
        })
      ).docs,
    ).toEqual([])
  })
})
