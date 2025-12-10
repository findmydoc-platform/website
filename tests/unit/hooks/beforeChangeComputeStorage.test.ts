import { describe, test, expect } from 'vitest'
import { vi } from 'vitest'
import type { PayloadRequest, SanitizedCollectionConfig, RequestContext } from 'payload'
import { createMockReq } from '../helpers/testHelpers'

// Stable crypto mock
vi.mock('crypto', () => {
  const impl = {
    createHash: () => ({ update: () => ({ digest: () => '112233aabb112233aabb112233aabb112233aabb' }) }),
  }
  return { default: impl, ...impl }
})

import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'

const createHookArgs = ({
  data,
  operation,
  originalDoc,
  req,
}: {
  data?: Record<string, unknown>
  operation: 'create' | 'update'
  originalDoc?: unknown
  req?: Partial<PayloadRequest> & { file?: { size: number; name: string; data: Buffer; mimetype: string } }
}) => ({
  data: { ...(data ?? {}) },
  operation,
  originalDoc,
  req: createMockReq(undefined, undefined, req) as PayloadRequest,
  collection: { slug: 'mock-collection' } as unknown as SanitizedCollectionConfig,
  context: {} as unknown as RequestContext,
})

describe('beforeChangeComputeStorage hook', () => {
  test('sets filename and storagePath on create when owner and id present', async () => {
    const hook = beforeChangeComputeStorage({ ownerField: 'clinic', key: { type: 'docId' }, storagePrefix: 'clinics' })
    const result = await hook(
      createHookArgs({
        data: { id: '77', clinic: 11, filename: 'images/pic.png' },
        operation: 'create',
      }),
    )
    expect(result.storagePath).toBe('clinics/11/77/pic.png')
    expect(result.filename).toBe('11/77/pic.png')
  })

  test('reuses existing storagePath on update without filename changes', async () => {
    const hook = beforeChangeComputeStorage({ ownerField: 'clinic', key: { type: 'docId' }, storagePrefix: 'clinics' })
    const result = await hook(
      createHookArgs({
        data: { clinic: 11 },
        operation: 'update',
        originalDoc: { id: '55', clinic: 11, filename: '11/55/pic.png', storagePath: 'clinics/11/55/pic.png' },
      }),
    )
    expect(result.storagePath).toBe('clinics/11/55/pic.png')
    expect(result.filename).toBeUndefined()
  })

  test('throws when required owner information is missing on create', async () => {
    const hook = beforeChangeComputeStorage({ ownerField: 'clinic', key: { type: 'docId' }, storagePrefix: 'clinics' })
    await expect(
      hook(
        createHookArgs({
          data: { id: '10', filename: 'file.png' },
          operation: 'create',
        }),
      ),
    ).rejects.toThrow('Unable to resolve owner for media upload')
  })

  test('supports alternate key fields for folder structure', async () => {
    const hook = beforeChangeComputeStorage({
      ownerField: 'clinic',
      key: { type: 'field', name: 'storageKey' },
      storagePrefix: 'clinics-gallery',
    })
    const result = await hook(
      createHookArgs({
        data: { clinic: 4, storageKey: 'variant-1', filename: 'gallery/photo.jpg' },
        operation: 'create',
      }),
    )
    expect(result.storagePath).toBe('clinics-gallery/4/variant-1/photo.jpg')
    expect(result.filename).toBe('4/variant-1/photo.jpg')
  })

  test('sanitizes path segments and filenames', async () => {
    const hook = beforeChangeComputeStorage({ ownerField: 'clinic', key: { type: 'docId' }, storagePrefix: 'clinics' })
    const result = await hook(
      createHookArgs({
        data: { id: '99/12', clinic: 'A/B', filename: '/nested/path/my image.png' },
        operation: 'create',
      }),
    )
    expect(result.storagePath).toBe('clinics/A_B/99/12/my image.png')
    expect(result.filename).toBe('A_B/99/12/my image.png')
  })

  test('supports key type hash for deriving folder key', async () => {
    const hook = beforeChangeComputeStorage({ ownerField: 'clinic', key: { type: 'hash' }, storagePrefix: 'clinics' })
    const result = await hook(
      createHookArgs({
        data: { clinic: 4, filename: 'some/path/photo.jpg' },
        operation: 'create',
      }),
    )
    expect(result.storagePath).toBe('clinics/4/112233aabb/photo.jpg')
    expect(result.filename).toBe('4/112233aabb/photo.jpg')
  })

  test('does not overwrite filename on update when there is no incoming upload', async () => {
    const hook = beforeChangeComputeStorage({ ownerField: 'clinic', key: { type: 'docId' }, storagePrefix: 'clinics' })
    const result = await hook(
      createHookArgs({
        data: { clinic: 11, filename: '11/77/pic.png' },
        operation: 'update',
        originalDoc: { id: '55', clinic: 11, filename: '11/55/pic.png', storagePath: 'clinics/11/55/pic.png' },
      }),
    )

    // No incoming upload — we should not overwrite filename (leave draft value intact)
    expect(result.storagePath).toBe('clinics/11/55/pic.png')
    expect(result.filename).toBe('11/77/pic.png')
  })

  test('overwrites filename on update when an incoming upload is present', async () => {
    const hook = beforeChangeComputeStorage({ ownerField: 'clinic', key: { type: 'docId' }, storagePrefix: 'clinics' })
    const result = await hook(
      createHookArgs({
        data: { id: '77', clinic: 11 },
        operation: 'update',
        originalDoc: { id: '77', clinic: 11, filename: '11/77/old.png', storagePath: 'clinics/11/77/old.png' },
        req: { file: { size: 12345, name: 'new.png', data: Buffer.from(''), mimetype: 'image/png' } },
      }),
    )

    expect(result.storagePath).toBe('clinics/11/77/new.png')
    expect(result.filename).toBe('11/77/new.png')
  })

  test('allows missing owner when ownerRequired is false', async () => {
    const hook = beforeChangeComputeStorage({
      ownerField: 'platformOwner',
      key: { type: 'field', name: 'storageKey' },
      storagePrefix: 'platform',
      ownerRequired: false,
    })

    const result = await hook(
      createHookArgs({
        data: { storageKey: 'asset-key', filename: 'hero.png' },
        operation: 'create',
      }),
    )

    expect(result.storagePath).toBe('platform/asset-key/hero.png')
    expect(result.filename).toBe('asset-key/hero.png')
  })
})
