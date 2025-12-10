import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { beforeChangePublishedAt } from '@/hooks/publishedAt'
import type { CollectionConfig, RequestContext } from 'payload'

const makeArgs = ({
  data,
  originalDoc,
}: {
  data?: Record<string, unknown>
  originalDoc?: Record<string, unknown>
}) => ({
  data: { ...(data ?? {}) },
  originalDoc,
  collection: { slug: 'mock' } as unknown as CollectionConfig,
  context: {} as unknown as RequestContext,
  req: undefined,
})

describe('beforeChangePublishedAt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sets publishedAt when transitioning into published status', async () => {
    const hook = beforeChangePublishedAt({})

    const result = await hook(
      makeArgs({ data: { status: 'published' }, originalDoc: { status: 'draft', publishedAt: null } }),
    )

    expect(result.publishedAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('nulls publishedAt when transitioning out of published status', async () => {
    const hook = beforeChangePublishedAt({})

    const result = await hook(
      makeArgs({ data: { status: 'draft' }, originalDoc: { status: 'published', publishedAt: '2023-10-10' } }),
    )

    expect(result.publishedAt).toBeNull()
  })

  it('carries existing publishedAt forward when unchanged and draft omits it', async () => {
    const hook = beforeChangePublishedAt({})

    const result = await hook(
      makeArgs({ data: { title: 'Same' }, originalDoc: { status: 'published', publishedAt: '2023-05-05' } }),
    )

    expect(result.publishedAt).toBe('2023-05-05')
  })

  it('preserves provided publishedAt when status stays published', async () => {
    const hook = beforeChangePublishedAt({})

    const result = await hook(
      makeArgs({ data: { status: 'published', publishedAt: '2025-02-02' }, originalDoc: { status: 'published' } }),
    )

    expect(result.publishedAt).toBe('2025-02-02')
  })
})
