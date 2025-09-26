import { describe, expect, test } from 'vitest'
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

    expect(result.createdBy).toBe(9)
    expect(result.filename).toBe('501/hero.png')
    expect(result.storagePath).toBe('platform/501/hero.png')
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

    expect(result.storagePath).toBe('platform/777/hero.png')
    expect(result.filename).toBeUndefined()
  })
})
