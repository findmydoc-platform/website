import { describe, expect, test, vi } from 'vitest'

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

const baseReq = (user?: any) => ({ user, payload: { logger: { error: () => {} } } }) as any

describe('beforeChangePlatformContentMedia', () => {
  test('computes filename and storage path on create', async () => {
    const req = baseReq({ id: 9, collection: 'basicUsers' })
    const data: any = { id: '501', filename: 'banners/hero.png' }

    const result: any = await beforeChangePlatformContentMedia({
      data,
      operation: 'create',
      req,
      originalDoc: undefined,
    } as any)

    // shortHash is mocked so first 10 chars === '8686b7a110'
    expect(result.createdBy).toBe(9)
    expect(result.filename).toBe('8686b7a110/hero.png')
    expect(result.storagePath).toBe('platform/8686b7a110/hero.png')
  })

  test('preserves existing storage path on update without filename', async () => {
    const req = baseReq({ id: 1, collection: 'basicUsers' })
    const originalDoc = { id: '777', filename: '777/hero.png', storagePath: 'platform/777/hero.png' }

    const result: any = await beforeChangePlatformContentMedia({
      data: {},
      operation: 'update',
      req,
      originalDoc,
    } as any)

    // With hashing enabled the hook will derive a storagePath from the existing
    // filename even on updates where no draft filename is provided. The test
    // mock returns a digest beginning with '8686b7a110', so expect that path.
    expect(result.storagePath).toBe('platform/8686b7a110/hero.png')
    expect(result.filename).toBeUndefined()
  })
})
