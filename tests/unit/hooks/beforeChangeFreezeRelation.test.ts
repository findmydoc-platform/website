import { describe, test, expect } from 'vitest'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'

const createHookArgs = ({
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
  collection: { slug: 'mock-collection' } as any,
  context: {} as any,
  req: undefined,
})

describe('beforeChangeFreezeRelation hook', () => {
  test('throws when relation changes on update', async () => {
    const hook = beforeChangeFreezeRelation({ relationField: 'clinic', message: 'clinic frozen' })
    await expect(
      hook(createHookArgs({ data: { clinic: 2 }, operation: 'update', originalDoc: { clinic: 1 } })),
    ).rejects.toThrow('clinic frozen')
  })

  test('uses default message when not provided', async () => {
    const hook = beforeChangeFreezeRelation({ relationField: 'clinic' })
    await expect(
      hook(
        createHookArgs({
          data: { clinic: { id: 9 } },
          operation: 'update',
          originalDoc: { clinic: { id: 3 } },
        }),
      ),
    ).rejects.toThrow('clinic cannot be changed once set')
  })

  test('allows updates when relation remains the same', async () => {
    const hook = beforeChangeFreezeRelation({ relationField: 'clinic' })
    const result = await hook(
      createHookArgs({
        data: { clinic: { id: '5' }, name: 'Example' },
        operation: 'update',
        originalDoc: { clinic: { id: 5 }, name: 'Example' },
      }),
    )
    expect(result).toMatchObject({ clinic: { id: '5' }, name: 'Example' })
  })

  test('does not alter data on create operations', async () => {
    const hook = beforeChangeFreezeRelation({ relationField: 'clinic' })
    const draft = { clinic: { id: 10 }, name: 'New' }
    const result = await hook(createHookArgs({ data: draft, operation: 'create' }))
    expect(result).toEqual(draft)
  })

  test('supports custom extractId implementations', async () => {
    const hook = beforeChangeFreezeRelation({
      relationField: 'owner',
      extractId: (value) => (value && typeof value === 'object' ? String((value as any).meta?.uid) : null),
    })
    const draft = { owner: { meta: { uid: 'abc' } } }
    const result = await hook(
      createHookArgs({
        data: draft,
        operation: 'update',
        originalDoc: { owner: { meta: { uid: 'abc' } } },
      }),
    )
    expect(result.owner.meta.uid).toBe('abc')
  })
})
