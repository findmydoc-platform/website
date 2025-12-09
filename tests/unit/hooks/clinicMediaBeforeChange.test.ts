/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { ClinicMedia } from '@/collections/ClinicMedia'

const baseReq = (user?: any) => ({ user, payload: { logger: { warn: () => {}, error: () => {} } } }) as any

const runBeforeChangeHooks = async ({
  data,
  operation,
  req,
  originalDoc,
}: {
  data: any
  operation: 'create' | 'update'
  req: any
  originalDoc?: any
}) => {
  const hooks = (ClinicMedia.hooks?.beforeChange ?? []) as CollectionBeforeChangeHook<any>[]
  const collection = { slug: ClinicMedia.slug } as any
  const context = {} as any
  let current = { ...(data || {}) }
  for (const hook of hooks) {
    current = await hook({ data: current, operation, req, originalDoc, collection, context })
  }
  return current
}

describe('beforeChangeClinicMedia', () => {
  test('auto-sets createdBy on create for basicUsers', async () => {
    const req = baseReq({ id: 42, collection: 'basicUsers', userType: 'clinic' })
    const data: any = { id: '123', clinic: 7, filename: 'photo.jpg' }
    const result: any = await runBeforeChangeHooks({ data, operation: 'create', req, originalDoc: undefined })
    expect(result.createdBy).toBe(42)
  })

  test('freezes clinic ownership on update (throws when changed)', async () => {
    const req = baseReq({ id: 1, collection: 'basicUsers', userType: 'platform' })
    const originalDoc: any = { clinic: 5 }
    await expect(runBeforeChangeHooks({ data: { clinic: 6 }, operation: 'update', req, originalDoc })).rejects.toThrow(
      'Clinic ownership cannot be changed once set',
    )
  })

  test('sets storagePath and prefixes filename with clinicId on create', async () => {
    const req = baseReq({ id: 9, collection: 'basicUsers', userType: 'clinic' })
    const data: any = { id: '77', clinic: 11, filename: 'images/pic.png' }
    const result: any = await runBeforeChangeHooks({ data, operation: 'create', req, originalDoc: undefined })
    expect(result.storagePath).toBe('clinics/11/77/pic.png')
    expect(result.filename).toBe('11/77/pic.png')
  })

  test('does not change filename on update, but keeps storagePath', async () => {
    const req = baseReq({ id: 9, collection: 'basicUsers', userType: 'clinic' })
    const data: any = { clinic: 11 }
    const result: any = await runBeforeChangeHooks({
      data,
      operation: 'update',
      req,
      originalDoc: { id: '55', clinic: 11, filename: '11/55/pic.png', storagePath: 'clinics/11/55/pic.png' },
    })
    expect(result.storagePath).toBe('clinics/11/55/pic.png')
    expect(result.filename).toBeUndefined()
  })
})
