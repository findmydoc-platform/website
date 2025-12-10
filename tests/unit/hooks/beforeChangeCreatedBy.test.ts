import { describe, test, expect } from 'vitest'
import { beforeChangeCreatedBy } from '@/hooks/createdBy'
import type { PayloadRequest, RequestContext, SanitizedCollectionConfig } from 'payload'

const createHookArgs = ({
  data,
  operation,
  req,
  originalDoc,
}: {
  data?: Record<string, unknown>
  operation: 'create' | 'update'
  req?: unknown
  originalDoc?: unknown
}) => ({
  data: { ...(data ?? {}) },
  operation,
  req: req as PayloadRequest,
  originalDoc,
  collection: { slug: 'mock-collection' } as unknown as SanitizedCollectionConfig,
  context: {} as unknown as RequestContext,
})

describe('beforeChangeCreatedBy hook', () => {
  test('stamps createdBy from matching user collection on create', async () => {
    const hook = beforeChangeCreatedBy({ createdByField: 'createdBy', userCollection: 'basicUsers' })
    const req = { user: { id: 42, collection: 'basicUsers' } }
    const result = await hook(createHookArgs({ data: {}, operation: 'create', req }))
    expect(result.createdBy).toBe(42)
  })

  test('preserves existing createdBy value', async () => {
    const hook = beforeChangeCreatedBy({ createdByField: 'createdBy', userCollection: 'basicUsers' })
    const req = { user: { id: 11, collection: 'basicUsers' } }
    const result = await hook(createHookArgs({ data: { createdBy: 99 }, operation: 'create', req }))
    expect(result.createdBy).toBe(99)
  })

  test('ignores users from other collections', async () => {
    const hook = beforeChangeCreatedBy({ createdByField: 'createdBy', userCollection: 'basicUsers' })
    const req = { user: { id: 3, collection: 'platformStaff' } }
    const result = await hook(createHookArgs({ data: {}, operation: 'create', req }))
    expect(result.createdBy).toBeUndefined()
  })

  test('does not modify documents during update', async () => {
    const hook = beforeChangeCreatedBy({ createdByField: 'createdBy', userCollection: 'basicUsers' })
    const req = { user: { id: 55, collection: 'basicUsers' } }
    const result = await hook(
      createHookArgs({
        data: { createdBy: 21 },
        operation: 'update',
        req,
        originalDoc: { createdBy: 21 },
      }),
    )
    expect(result.createdBy).toBe(21)
  })

  test('supports custom field name and collection', async () => {
    const hook = beforeChangeCreatedBy({ createdByField: 'owner', userCollection: 'clinicStaff' })
    const req = { user: { id: 'abc', collection: 'clinicStaff' } }
    const result = await hook(createHookArgs({ data: {}, operation: 'create', req }))
    expect(result.owner).toBe('abc')
  })
})
