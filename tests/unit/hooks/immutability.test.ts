import { describe, it, expect } from 'vitest'
import { beforeChangeImmutableField } from '@/hooks/immutability'

const makeArgs = ({
  data,
  operation,
  originalDoc,
}: {
  data?: Record<string, unknown>
  operation: 'create' | 'update'
  originalDoc?: any
}) => ({
  data: { ...(data ?? {}) },
  operation,
  originalDoc,
  collection: { slug: 'mock' } as any,
  context: {} as any,
  req: undefined,
})

describe('beforeChangeImmutableField', () => {
  it('throws when updating an immutable string field to a different value', async () => {
    const hook = beforeChangeImmutableField({ field: 'slug' })

    await expect(
      hook(
        makeArgs({
          data: { slug: 'new-slug' },
          originalDoc: { slug: 'old-slug' },
          operation: 'update',
        }),
      ),
    ).rejects.toThrow('slug cannot be changed once set')
  })

  it('allows updates when value is unchanged', async () => {
    const hook = beforeChangeImmutableField({ field: 'slug' })

    const result = await hook(makeArgs({ data: { slug: 'same' }, originalDoc: { slug: 'same' }, operation: 'update' }))

    expect(result.slug).toBe('same')
  })

  it('backfills missing value from original when enabled', async () => {
    const hook = beforeChangeImmutableField({ field: 'slug' })

    const result = await hook(makeArgs({ data: {}, originalDoc: { slug: 'preserve-me' }, operation: 'update' }))

    expect(result.slug).toBe('preserve-me')
  })

  it('skips backfill when disabled', async () => {
    const hook = beforeChangeImmutableField({ field: 'slug', backfill: false })

    const result = await hook(makeArgs({ data: {}, originalDoc: { slug: 'keep' }, operation: 'update' }))

    expect(result.slug).toBeUndefined()
  })

  it('does not block create operations', async () => {
    const hook = beforeChangeImmutableField({ field: 'slug' })

    const draft = { slug: 'initial', name: 'Example' }
    const result = await hook(makeArgs({ data: draft, operation: 'create' }))

    expect(result).toEqual(draft)
  })
})
