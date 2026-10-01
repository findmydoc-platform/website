import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'
import { AuthActions } from '@/collections/AuthActions'

const request = (collection?: 'platformStaff' | 'clinicStaff' | 'patients') =>
  ({ user: collection ? { id: 1, collection } : null, context: {} }) as PayloadRequest

describe('AuthActions collection boundary', () => {
  it.each([undefined, 'clinicStaff', 'patients', 'platformStaff'] as const)(
    'denies generic mutations for %s',
    async (collection) => {
      const req = request(collection)
      for (const operation of ['create', 'update', 'delete'] as const) {
        expect(await AuthActions.access?.[operation]?.({ req })).toBe(false)
      }
    },
  )

  it('allows only platform staff to read content-free diagnostics', async () => {
    for (const collection of [undefined, 'clinicStaff', 'patients', 'platformStaff'] as const) {
      const req = request(collection)
      expect(await AuthActions.access?.read?.({ req })).toBe(collection === 'platformStaff')
    }
    const afterRead = AuthActions.hooks!.afterRead![0]!
    const doc = {
      id: 41,
      actionType: 'patient-verification',
      environment: 'test',
      state: 'pending',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
      expiresAt: '2026-10-02T10:00:00.000Z',
      principal: { relationTo: 'patients', value: 2 },
      callbackDestination: 'website-auth-callback',
      completionRoute: '/patient/inquiries',
      finalDestination: 'patient-inquiries',
      unexpectedSecret: 'must not escape',
    }
    expect(await afterRead({ doc, req: request('platformStaff') } as Parameters<typeof afterRead>[0])).toEqual({
      id: 41,
      actionType: 'patient-verification',
      environment: 'test',
      state: 'pending',
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      expiresAt: doc.expiresAt,
    })
  })

  it('rejects local API mutation without an opaque system capability', async () => {
    const beforeOperation = AuthActions.hooks!.beforeOperation![0]!
    await expect(
      beforeOperation({ operation: 'create', req: request('platformStaff') } as Parameters<typeof beforeOperation>[0]),
    ).rejects.toMatchObject({ status: 403 })
  })
})
