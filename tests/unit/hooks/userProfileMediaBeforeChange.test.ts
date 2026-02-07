import { describe, expect, test, vi } from 'vitest'
import type { CollectionBeforeChangeHook, PayloadRequest, SanitizedCollectionConfig, RequestContext } from 'payload'
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

const runBeforeChangeHooks = async ({
  data,
  operation,
  req,
  originalDoc,
}: {
  data: unknown
  operation: 'create' | 'update'
  req: PayloadRequest
  originalDoc?: unknown
}) => {
  const hooks = (UserProfileMedia.hooks?.beforeChange ?? []) as CollectionBeforeChangeHook[]
  const collection = { slug: UserProfileMedia.slug } as unknown as SanitizedCollectionConfig
  const context = {} as unknown as RequestContext
  let current = { ...((data as Record<string, unknown>) || {}) }
  for (const hook of hooks) {
    current = await hook({ data: current, operation, req, originalDoc, collection, context })
  }
  return current
}

const baseReq = (user?: unknown) =>
  ({
    user,
    payload: {
      findByID: vi.fn(),
      logger: { error: () => {} },
    },
  }) as unknown as PayloadRequest

describe('beforeChangeUserProfileMedia (hash-based)', () => {
  test('defaults owner, computes hashed storage path, and stamps createdBy on create', async () => {
    const req = baseReq({ id: 24, collection: 'basicUsers' })
    const data = { id: 301, filename: 'avatars/photo.jpeg' }

    const result = (await runBeforeChangeHooks({ data, operation: 'create', req, originalDoc: undefined })) as Record<
      string,
      unknown
    >

    expect(result.user).toEqual({ relationTo: 'basicUsers', value: 24 })
    // CreatedBy is stamped as a union
    expect(result.createdBy).toEqual({ relationTo: 'basicUsers', value: 24 })
    // shortHash('owner:filename') first 10 chars from mocked digest => 'abcdef1234'
    expect(result.filename).toBe('24-abcdef1234-photo.jpeg')
    expect(result.storagePath).toBe('users/24-abcdef1234-photo.jpeg')
  })

  test('overwrites createdBy on create (prevents spoofing)', async () => {
    const req = baseReq({ id: 24, collection: 'basicUsers' })
    const data = {
      id: 302,
      filename: 'avatars/spoof.jpeg',
      createdBy: { relationTo: 'patients', value: 999 },
    }

    const result = (await runBeforeChangeHooks({ data, operation: 'create', req, originalDoc: undefined })) as Record<
      string,
      unknown
    >

    expect(result.createdBy).toEqual({ relationTo: 'basicUsers', value: 24 })
  })

  test('prevents changing createdBy on update', async () => {
    const req = baseReq({ id: 24, collection: 'basicUsers' })

    await expect(
      runBeforeChangeHooks({
        data: { createdBy: { relationTo: 'basicUsers', value: 77 } },
        operation: 'update',
        req,
        originalDoc: { createdBy: { relationTo: 'basicUsers', value: 24 } },
      }),
    ).rejects.toThrow('createdBy cannot be changed once set')
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
