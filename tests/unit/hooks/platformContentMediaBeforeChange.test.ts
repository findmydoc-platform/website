import { describe, expect, test, vi } from 'vitest'
import type { SanitizedCollectionConfig, PayloadRequest, RequestContext } from 'payload'
import type { PlatformContentMedia } from '@/payload-types'

// Mock crypto to produce a stable, predictable short-hash for tests.
vi.mock('crypto', () => {
  const impl = {
    createHash: () => ({
      update: () => ({
        digest: () => '8686b7a1108686b7a1108686b7a1108686b7a11',
      }),
    }),
  }
  return {
    default: impl,
    ...impl,
  }
})

import { beforeChangePlatformContentMedia } from '@/collections/PlatformContentMedia/hooks/beforeChangePlatformContentMedia'

const baseReq = (user?: unknown) => ({ user, payload: { logger: { error: () => {} } } }) as unknown as PayloadRequest
const mockCollection = { slug: 'platformContentMedia' } as unknown as SanitizedCollectionConfig
const emptyContext = {} as unknown as RequestContext

describe('beforeChangePlatformContentMedia', () => {
  test('computes filename and storage path on create', async () => {
    const req = baseReq({ id: 9, collection: 'basicUsers' })
    const data: Partial<PlatformContentMedia> = { id: 501, filename: 'banners/hero.png' }

    const result = (await beforeChangePlatformContentMedia({
      data,
      operation: 'create',
      req,
      originalDoc: undefined,
      collection: mockCollection,
      context: emptyContext,
    })) as Record<string, unknown>

    // shortHash is mocked so first 10 chars === '8686b7a110'
    expect(result.createdBy).toBe(9)
    expect(result.filename).toBe('8686b7a110-hero.png')
    expect(result.storagePath).toBe('platform/8686b7a110-hero.png')
  })

  test('preserves existing storage path on update without filename', async () => {
    const req = baseReq({ id: 1, collection: 'basicUsers' })
    const originalDoc = {
      id: 777,
      filename: '777-hero.png',
      storagePath: 'platform/777-hero.png',
    } as PlatformContentMedia

    const result = (await beforeChangePlatformContentMedia({
      data: {},
      operation: 'update',
      req,
      originalDoc,
      collection: mockCollection,
      context: emptyContext,
    })) as Record<string, unknown>

    // On metadata-only updates without a new upload, the existing storagePath
    // from originalDoc is preserved rather than recomputed.
    expect(result.storagePath).toBe('platform/777-hero.png')
    expect(result.filename).toBeUndefined()
  })

  test('does not override createdBy on update when editing metadata', async () => {
    const req = baseReq({ id: 44, collection: 'basicUsers' })
    const originalDoc = {
      id: 121,
      createdBy: 9,
      filename: '999-hero.png',
      storagePath: 'platform/999-hero.png',
    } as PlatformContentMedia

    const result = (await beforeChangePlatformContentMedia({
      data: { alt: 'Updated alt text' },
      operation: 'update',
      req,
      originalDoc,
      collection: mockCollection,
      context: emptyContext,
    })) as Record<string, unknown>

    expect(result.createdBy).toBeUndefined()
    expect(result.storagePath).toBe('platform/999-hero.png')
    expect(result.filename).toBeUndefined()
  })
})
