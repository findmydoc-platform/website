import { describe, test, expect } from 'vitest'
import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'

const createHookArgs = ({
  data,
  operation,
  originalDoc,
  req,
}: {
  data?: Record<string, unknown>
  operation: 'create' | 'update'
  originalDoc?: any
  req?: any
}) => ({
  data: { ...(data ?? {}) },
  operation,
  originalDoc,
  req,
  collection: { slug: 'mock-collection' } as any,
  context: {} as any,
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
})
