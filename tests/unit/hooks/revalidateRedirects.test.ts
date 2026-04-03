import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidateTag } from 'next/cache'
import type { PayloadRequest } from 'payload'

import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { createMockReq } from '../helpers/testHelpers'

type RedirectDoc = {
  id: string
}

const buildReq = (disableRevalidate = false): PayloadRequest =>
  createMockReq(null, undefined, {
    context: {
      disableRevalidate,
    },
  })

const getTagCalls = () => vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)

type HookArgs = Parameters<typeof revalidateRedirects>[0]

const buildArgs = (args: { doc: RedirectDoc; req: PayloadRequest }): HookArgs => ({
  collection: { slug: 'redirects' } as unknown as HookArgs['collection'],
  context: args.req.context,
  data: {},
  doc: args.doc,
  operation: 'update',
  previousDoc: undefined,
  req: args.req,
})

describe('revalidateRedirects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('revalidates the redirects tag for normal writes', () => {
    const req = buildReq(false)
    const doc: RedirectDoc = { id: 'redirect-1' }

    const result = revalidateRedirects(buildArgs({ doc, req })) as RedirectDoc

    expect(result).toBe(doc)
    expect(getTagCalls()).toEqual(['redirects'])
  })

  it('skips revalidation when disabled via context', () => {
    const req = buildReq(true)
    const doc: RedirectDoc = { id: 'redirect-1' }

    const result = revalidateRedirects(buildArgs({ doc, req })) as RedirectDoc

    expect(result).toBe(doc)
    expect(getTagCalls()).toEqual([])
  })
})
