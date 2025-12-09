/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, vi } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { UserProfileMedia } from '@/collections/UserProfileMedia'

// Stable mock for crypto hashing used by computeStorage
vi.mock('crypto', () => {
  const impl = {
    createHash: () => ({
      update: () => ({ digest: () => 'abcdef1234abcdef1234abcdef1234abcdef1234' }),
    }),
  }
  return { default: impl, ...impl }
})

const runBeforeChangeHooks = async ({ data, operation, req, originalDoc }: any) => {
  const hooks = (UserProfileMedia.hooks?.beforeChange ?? []) as CollectionBeforeChangeHook<any>[]
  const collection = { slug: UserProfileMedia.slug } as any
  const context = {} as any
  let current = { ...(data || {}) }
  for (const hook of hooks) {
    current = await hook({ data: current, operation, req, originalDoc, collection, context })
  }
  return current
}

const baseReq = (user?: any) =>
  ({
    user,
    payload: {
      findByID: vi.fn(),
      logger: { error: () => {} },
    },
  }) as any

describe('beforeChangeUserProfileMedia (hash-based)', () => {
  test('computes hashed storage path and stamps createdBy on create', async () => {
    const req = baseReq({ id: '24', collection: 'basicUsers' })
    const data: any = { id: '301', user: { relationTo: 'basicUsers', value: '24' }, filename: 'avatars/photo.jpeg' }

    const result: any = await runBeforeChangeHooks({ data, operation: 'create', req, originalDoc: undefined })

    // CreatedBy is stamped as a union
    expect(result.createdBy).toEqual({ relationTo: 'basicUsers', value: '24' })
    // shortHash('owner:filename') first 10 chars from mocked digest => 'abcdef1234'
    expect(result.filename).toBe('24/abcdef1234/photo.jpeg')
    expect(result.storagePath).toBe('users/24/abcdef1234/photo.jpeg')
  })

  test('prevents changing owner on update', async () => {
    const req = baseReq({ id: '11', collection: 'basicUsers' })
    await expect(
      runBeforeChangeHooks({
        data: { user: { relationTo: 'basicUsers', value: '99' } },
        operation: 'update',
        req,
        originalDoc: { user: { relationTo: 'patients', value: '44' } },
      }),
    ).rejects.toThrow('User ownership cannot be changed once set')
  })
})
