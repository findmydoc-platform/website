import { describe, expect, test } from 'vitest'
import type { CollectionBeforeChangeHook, PayloadRequest, SanitizedCollectionConfig, RequestContext } from 'payload'
import { ClinicMedia } from '@/collections/ClinicMedia'

const baseReq = (user?: unknown) =>
  ({ user, payload: { logger: { warn: () => {}, error: () => {} } } }) as unknown as PayloadRequest

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
  const hooks = (ClinicMedia.hooks?.beforeChange ?? []) as CollectionBeforeChangeHook[]
  const collection = { slug: ClinicMedia.slug } as unknown as SanitizedCollectionConfig
  const context = {} as unknown as RequestContext
  let current = { ...((data as Record<string, unknown>) || {}) }
  for (const hook of hooks) {
    current = await hook({ data: current, operation, req, originalDoc, collection, context })
  }
  return current
}

describe('beforeChangeClinicMedia', () => {
  test('auto-sets createdBy on create for basicUsers', async () => {
    const req = baseReq({ id: 42, collection: 'basicUsers', userType: 'clinic' })
    const data = { id: '123', clinic: 7, filename: 'photo.jpg' }
    const result = (await runBeforeChangeHooks({ data, operation: 'create', req, originalDoc: undefined })) as Record<
      string,
      unknown
    >
    expect(result.createdBy).toBe(42)
  })

  test('freezes clinic ownership on update (throws when changed)', async () => {
    const req = baseReq({ id: 1, collection: 'basicUsers', userType: 'platform' })
    const originalDoc = { clinic: 5 }
    await expect(runBeforeChangeHooks({ data: { clinic: 6 }, operation: 'update', req, originalDoc })).rejects.toThrow(
      'Clinic ownership cannot be changed once set',
    )
  })

  test('sets storagePath and prefixes filename with clinicId on create', async () => {
    const req = baseReq({ id: 9, collection: 'basicUsers', userType: 'clinic' })
    const data = { id: '77', clinic: 11, filename: 'images/pic.png' }
    const result = (await runBeforeChangeHooks({ data, operation: 'create', req, originalDoc: undefined })) as Record<
      string,
      unknown
    >
    expect(result.storagePath).toBe('clinics/11-77-pic.png')
    expect(result.filename).toBe('11-77-pic.png')
  })

  test('does not change filename on update, but keeps storagePath', async () => {
    const req = baseReq({ id: 9, collection: 'basicUsers', userType: 'clinic' })
    const data = { clinic: 11 }
    const result = (await runBeforeChangeHooks({
      data,
      operation: 'update',
      req,
      originalDoc: { id: '55', clinic: 11, filename: '11-55-pic.png', storagePath: 'clinics/11-55-pic.png' },
    })) as Record<string, unknown>
    expect(result.storagePath).toBe('clinics/11-55-pic.png')
    expect(result.filename).toBeUndefined()
  })
})
