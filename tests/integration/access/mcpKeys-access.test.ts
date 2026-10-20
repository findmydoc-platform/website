import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '@payload-config'
import {
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createPlatformTestUser,
  type PayloadRequestUser,
} from '../../fixtures/testUsers'
import { testSlug } from '../../fixtures/testSlug'

describe('MCP key management and client access', () => {
  let payload: Payload
  let admin: PayloadRequestUser
  let support: PayloadRequestUser
  const staffIds: Array<number | string> = []
  const keyIds: number[] = []
  const prefix = testSlug('mcpKeys-access.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    const first = await createPlatformTestUser(payload, { emailPrefix: `${prefix}-admin`, createdStaffIds: staffIds })
    admin = asPayloadStaffUser(
      await payload.update({
        collection: 'platformStaff',
        id: first.id,
        data: { role: 'admin' },
        context: { trustedPlatformStaffOps: true },
        overrideAccess: true,
      }),
    )
    support = asPayloadStaffUser(
      await createPlatformTestUser(payload, {
        emailPrefix: `${prefix}-support`,
        createdStaffIds: staffIds,
      }),
    )
  })

  afterAll(async () => {
    for (const id of keyIds) await payload.delete({ collection: 'payload-mcp-api-keys', id, overrideAccess: true })
    await cleanupTrackedUsers(payload, { staffIds })
  })

  it('lets an administrator manage their bound key and denies a stale administrator after role removal', async () => {
    const key = await payload.create({
      collection: 'payload-mcp-api-keys',
      user: admin,
      overrideAccess: false,
      data: { user: support.id, label: `${prefix}-managed`, enableAPIKey: true, apiKey: randomUUID() },
    })
    keyIds.push(key.id)
    expect(key.user).toMatchObject({ id: admin.id })
    expect(
      (
        await payload.findByID({
          collection: 'payload-mcp-api-keys',
          id: key.id,
          user: admin,
          overrideAccess: false,
        })
      ).id,
    ).toBe(key.id)
    const updated = await payload.update({
      collection: 'payload-mcp-api-keys',
      id: key.id,
      data: { user: support.id, label: `${prefix}-updated` },
      user: admin,
      overrideAccess: false,
    })
    expect(updated).toMatchObject({ label: `${prefix}-updated`, user: { id: admin.id } })
    await payload.update({
      collection: 'platformStaff',
      id: admin.id,
      data: { role: 'content-manager' },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    })

    for (const user of [admin, support]) {
      await expect(
        payload.find({ collection: 'payload-mcp-api-keys', user, overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.create({
          collection: 'payload-mcp-api-keys',
          user,
          overrideAccess: false,
          data: { user: user.id, label: 'Blocked' },
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.update({
          collection: 'payload-mcp-api-keys',
          id: key.id,
          user,
          overrideAccess: false,
          data: { user: user.id, label: 'Blocked' },
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.delete({ collection: 'payload-mcp-api-keys', id: key.id, user, overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
    }
  })

  it('uses an existing support-owned key through the real MCP endpoint while management stays forbidden', async () => {
    const apiKey = randomUUID()
    const key = await payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      data: { user: support.id, label: `${prefix}-existing`, enableAPIKey: true, apiKey, posts: { find: true } },
    })
    keyIds.push(key.id)
    await expect(
      payload.findByID({
        collection: 'payload-mcp-api-keys',
        id: key.id,
        user: support,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })

    const endpoint = payload.config.endpoints.find((entry) => entry.path === '/mcp' && entry.method === 'post')
    if (!endpoint) throw new Error('Expected the MCP POST endpoint')
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'findPosts', arguments: { limit: 1 } },
      }),
    })
    const req = await createLocalReq(
      {
        req: {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
        },
      },
      payload,
    )
    const response = await endpoint.handler(req)
    expect(response.status).toBe(200)
    const text = await response.text()
    const result = JSON.parse(
      text.startsWith('data:') || text.includes('\ndata:')
        ? text
            .split('\n')
            .find((line) => line.startsWith('data:'))!
            .slice(5)
            .trim()
        : text,
    )
    expect(result.error).toBeUndefined()
    expect(result.result.content[0].text).toContain('Collection: "posts"')
    expect(req.user).toMatchObject({ id: support.id, collection: 'platformStaff', role: 'support' })
  })
})
