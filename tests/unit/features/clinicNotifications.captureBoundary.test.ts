import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { ClinicNotificationControls } from '@/collections/ClinicNotificationControls'

async function write(data: Record<string, unknown>, originalDoc: Record<string, unknown> = {}) {
  const req = {
    transactionID: 'native',
    context: { clinicNotificationCommand: true, clinicNotificationActivation: { authorized: true } },
    payload: { db: { sessions: { native: {} } } },
  } as unknown as PayloadRequest
  let next = data
  for (const hook of ClinicNotificationControls.hooks!.beforeChange!)
    next = await hook({
      data: next,
      originalDoc,
      req,
      operation: originalDoc.id ? 'update' : 'create',
    } as Parameters<CollectionBeforeChangeHook>[0])
  return next
}

describe('notification capture boundary through collection hooks', () => {
  it('denies activation despite forged serializable context and access override', async () => {
    await expect(write({ key: 'notification-center', active: true, nonce: 'synthetic' })).rejects.toMatchObject({
      status: 403,
    })
  })
  it.each([{ active: false }, { activatedAt: '2026-10-18T10:00:00.000Z' }, { key: 'renamed-center' }])(
    'denies reset, replacement timestamp and identity changes',
    async (data) => {
      await expect(
        write(data, { id: 1, key: 'notification-center', active: true, activatedAt: '2026-10-17T10:00:00.000Z' }),
      ).rejects.toMatchObject({ status: 403 })
    },
  )
  it('retains source nonce serialization while capture is active', async () => {
    await expect(
      write(
        { nonce: 'new-source-nonce' },
        { id: 1, key: 'notification-center', active: true, activatedAt: '2026-10-17T10:00:00.000Z' },
      ),
    ).resolves.toEqual({ nonce: 'new-source-nonce' })
  })
})
