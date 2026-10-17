import { describe, expect, it, vi } from 'vitest'
import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, PayloadRequest } from 'payload'
import { authorizeClinicMediaDelete, authorizeClinicMediaWrite } from '@/collections/ClinicMedia/authorization'

const request = (user?: { collection: string }, native = true) =>
  ({
    user,
    context: {},
    transactionID: native ? 'delete' : undefined,
    payload: { db: { sessions: { delete: {} } }, findByID: vi.fn(async () => ({ id: 1, clinic: null })) },
  }) as unknown as PayloadRequest
const execute = (req: PayloadRequest) =>
  authorizeClinicMediaDelete({ id: 1, req } as Parameters<CollectionBeforeDeleteHook>[0])

describe('clinic media orphan deletion', () => {
  it.each([undefined, { collection: 'platformStaff' }])('preserves privileged orphan deletion for %j', async (user) => {
    await expect(execute(request(user))).resolves.toBeUndefined()
  })
  it.each(['clinicStaff', 'patients'])('denies orphan deletion for %s', async (collection) => {
    await expect(execute(request({ collection }))).rejects.toMatchObject({ status: 403 })
  })
  it('does not treat a cleanup target as permission for an ownerless record', async () => {
    const req = request()
    req.context.clinicGalleryCleanupTarget = '7'
    await expect(execute(req)).rejects.toMatchObject({ status: 403 })
  })
  it('does not let an orphan receive a new clinic owner', async () => {
    await expect(
      authorizeClinicMediaWrite({
        operation: 'update',
        req: request({ collection: 'platformStaff' }),
        data: { clinic: 7 },
        originalDoc: { clinic: null },
      } as unknown as Parameters<CollectionBeforeChangeHook>[0]),
    ).rejects.toMatchObject({ status: 403 })
  })
  it('requires an active native owner for privileged orphan deletion', async () => {
    await expect(execute(request(undefined, false))).rejects.toThrow('active native transaction')
  })
})
