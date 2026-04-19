import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { computeStorage } from '@/hooks/media/computeStorage'
import { createMockReq } from '../helpers/testHelpers'

vi.mock('crypto', () => {
  const impl = {
    createHash: () => ({ update: () => ({ digest: () => '112233aabb112233aabb112233aabb112233aabb' }) }),
  }
  return { default: impl, ...impl }
})

const createReq = (overrides?: Partial<PayloadRequest>) => createMockReq(undefined, undefined, overrides)

describe('computeStorage', () => {
  it('reuses the original storage path for hash-key updates without a new upload', () => {
    const result = computeStorage({
      operation: 'update',
      draft: {},
      originalDoc: {
        storagePath: 'platform/original-asset.png',
      },
      key: { type: 'hash' },
      storagePrefix: 'platform',
      ownerField: 'platformOwner',
      ownerRequired: false,
    })

    expect(result).toEqual({ storagePath: 'platform/original-asset.png' })
  })

  it('falls back to the draft storage path for hash-key updates when original storage is missing', () => {
    const result = computeStorage({
      operation: 'update',
      draft: {
        storagePath: 'platform/draft-asset.png',
      },
      originalDoc: {},
      key: { type: 'hash' },
      storagePrefix: 'platform',
      ownerField: 'platformOwner',
      ownerRequired: false,
    })

    expect(result).toEqual({ storagePath: 'platform/draft-asset.png' })
  })

  it('derives a stable fallback hash when a field key is missing on create', () => {
    const result = computeStorage({
      operation: 'create',
      draft: {
        clinic: 11,
        filename: 'gallery/photo.jpg',
      },
      key: { type: 'field', name: 'storageKey' },
      storagePrefix: 'clinics-gallery',
    })

    expect(result).toEqual({
      filename: '11-112233aabb-photo.jpg',
      storagePath: 'clinics-gallery/11-112233aabb-photo.jpg',
    })
  })

  it('logs and throws when create cannot resolve a filename', () => {
    const req = createReq()

    expect(() =>
      computeStorage({
        operation: 'create',
        draft: {
          id: '77',
          clinic: 11,
        },
        req,
        key: { type: 'docId' },
        storagePrefix: 'clinics',
      }),
    ).toThrow('Unable to resolve filename for media upload')

    expect(req.payload.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        baseFilename: null,
        event: 'storage.media.path_resolution_failed',
        folderKey: '77',
        keySource: 'docId',
        operation: 'create',
        owner: '11',
        ownerField: 'clinic',
        scope: 'storage.media',
        storagePrefix: 'clinics',
      }),
      'Media storage path resolution failed during create',
    )
  })

  it('respects overwriteFilename and preserves the fallback storage path on upload updates', () => {
    const overwriteFilename = vi.fn(() => false)
    const req = createReq({
      file: {
        size: 123,
        name: 'replacement.png',
        data: Buffer.from(''),
        mimetype: 'image/png',
      },
    } as Partial<PayloadRequest>)

    const result = computeStorage({
      operation: 'update',
      draft: {
        id: '55',
        clinic: 11,
      },
      originalDoc: {
        id: '55',
        clinic: 11,
        filename: '11-55-original.png',
        storagePath: 'clinics/11-55-original.png',
      },
      req,
      key: { type: 'docId' },
      storagePrefix: 'clinics',
      overwriteFilename,
    })

    expect(overwriteFilename).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({
        clinic: 11,
        id: '55',
      }),
    )
    expect(result).toEqual({
      filename: undefined,
      storagePath: 'clinics/11-55-original.png',
    })
  })

  it('returns a recomputed storage path when overwriteFilename is disabled but no fallback exists', () => {
    const req = createReq({
      file: {
        size: 456,
        name: 'fresh.png',
        data: Buffer.from(''),
        mimetype: 'image/png',
      },
    } as Partial<PayloadRequest>)

    const result = computeStorage({
      operation: 'update',
      draft: {
        id: '91',
        clinic: 15,
      },
      originalDoc: {
        id: '91',
        clinic: 15,
        filename: '15-91-original.png',
      },
      req,
      key: { type: 'docId' },
      storagePrefix: 'clinics',
      overwriteFilename: () => false,
    })

    expect(result).toEqual({
      filename: undefined,
      storagePath: 'clinics/15-91-fresh.png',
    })
  })
})
