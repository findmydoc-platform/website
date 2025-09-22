import { describe, test, expect } from 'vitest'
import { beforeChangeClinicMedia } from '@/collections/ClinicMedia/hooks/beforeChangeClinicMedia'

const baseReq = (user?: any) => ({ user, payload: { logger: { warn: () => {}, error: () => {} } } }) as any

describe('beforeChangeClinicMedia', () => {
  test('auto-sets createdBy on create for basicUsers', async () => {
    const req = baseReq({ id: 42, collection: 'basicUsers', userType: 'clinic' })
    const data: any = { clinic: 7, filename: 'photo.jpg' }
    const result: any = await beforeChangeClinicMedia({ data, operation: 'create', req, originalDoc: undefined } as any)
    expect(result.createdBy).toBe(42)
  })

  test('freezes clinic ownership on update (throws when changed)', async () => {
    const req = baseReq({ id: 1, collection: 'basicUsers', userType: 'platform' })
    const originalDoc: any = { clinic: 5 }
    await expect(
      beforeChangeClinicMedia({ data: { clinic: 6 }, operation: 'update', req, originalDoc } as any),
    ).rejects.toThrow('Clinic ownership cannot be changed once set')
  })

  test('sets storagePath and prefixes filename with clinicId on create', async () => {
    const req = baseReq({ id: 9, collection: 'basicUsers', userType: 'clinic' })
    const data: any = { clinic: 11, filename: 'images/pic.png' }
    const result: any = await beforeChangeClinicMedia({ data, operation: 'create', req, originalDoc: undefined } as any)
    expect(result.storagePath).toBe('clinics/11')
    expect(result.filename).toBe('11/images/pic.png')
  })

  test('does not change filename on update, but keeps storagePath', async () => {
    const req = baseReq({ id: 9, collection: 'basicUsers', userType: 'clinic' })
    const data: any = { clinic: 11, filename: '11/images/pic.png' }
    const result: any = await beforeChangeClinicMedia({
      data,
      operation: 'update',
      req,
      originalDoc: { clinic: 11 },
    } as any)
    expect(result.storagePath).toBe('clinics/11')
    expect(result.filename).toBe('11/images/pic.png')
  })
})
