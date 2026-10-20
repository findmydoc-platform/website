import type { CollectionBeforeValidateHook, PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateInquiryAttachment } from '@/collections/inquiryCommunication/invariants'
import { validateInquiryModerationCase } from '@/collections/inquiryModeration/invariants'

const access = vi.hoisted(() => ({ target: vi.fn(), barrier: vi.fn() }))
vi.mock('@/auth/utilities/clinicPrincipalAccess', () => ({ readClinicTargetAccess: access.target }))
vi.mock('@/features/clinicNotifications/authorizationBarrier', () => ({
  guardClinicAuthorizationKeys: access.barrier,
  clinicStaffAuthorizationKey: (id: unknown) => `staff:${id}`,
  notificationClinicAuthorizationKey: (id: unknown) => `clinic:${id}`,
}))

const inquiry = { id: 1, clinic: 2, patient: 3 }
const conversation = { id: 4, inquiry: 1, clinic: 2, patient: 3 }
const request = (clinicActor = false) =>
  ({
    user: { id: 9, collection: clinicActor ? 'clinicStaff' : 'platformStaff' },
    context: {},
    transactionID: 'owned',
    payload: {
      find: vi.fn(async ({ collection }: { collection: string }) => ({
        docs:
          collection === 'patientClinicInquiries'
            ? [inquiry]
            : collection === 'inquiryConversations'
              ? [conversation]
              : [],
      })),
    },
  }) as unknown as PayloadRequest

const cases = [
  {
    name: 'moderation decision',
    hook: validateInquiryModerationCase,
    original: {
      inquiry: 1,
      clinic: 2,
      patient: 3,
      conversation: 4,
      reporterKind: 'clinic',
      reporterClinicStaff: 7,
      reporterKey: 'clinicStaff:7',
      targetType: 'conversation',
      targetId: '4',
      category: 'privacy-concern',
      eventSequence: 1,
    },
    update: { status: 'decided', eventSequence: 2 },
    rebind: { reporterClinicStaff: 8, reporterKey: 'clinicStaff:8' },
  },
  {
    name: 'attachment cleanup',
    hook: validateInquiryAttachment,
    original: {
      inquiry: 1,
      clinic: 2,
      patient: 3,
      ownerKind: 'clinic',
      ownerClinicStaff: 7,
      actorKey: 'clinicStaff:7',
      state: 'discarded',
    },
    update: {
      cleanupCompletedAt: '2026-10-20T12:00:00.000Z',
      draftCleanupCompletedAt: '2026-10-20T12:00:00.000Z',
    },
    rebind: { ownerClinicStaff: 8, actorKey: 'clinicStaff:8' },
  },
] as const

describe.each(cases)('historical clinic actor during $name', ({ hook, original, update, rebind }) => {
  const run = (req: PayloadRequest, data: object, originalDoc?: object) =>
    hook({
      req,
      data,
      originalDoc,
      operation: originalDoc ? 'update' : 'create',
    } as Parameters<CollectionBeforeValidateHook>[0])

  beforeEach(() => {
    vi.clearAllMocks()
    access.target.mockResolvedValue(null)
  })

  it('lets the platform update a stored record after the original actor loses clinic access', async () => {
    const req = request()
    await expect(run(req, update, original)).resolves.toEqual(update)
    expect(access.barrier).toHaveBeenCalledWith(req, ['clinic:2'])
    expect(access.target).not.toHaveBeenCalled()
  })

  it('still denies the currently acting clinic principal after access loss', async () => {
    const req = request(true)
    await expect(run(req, update, original)).rejects.toMatchObject({ status: 403 })
    expect(access.target).toHaveBeenCalledWith(req.payload, 9, '2', req)
  })

  it('requires current clinic access when creating or rebinding the historical actor', async () => {
    await expect(run(request(), original)).rejects.toMatchObject({ status: 400 })
    await expect(run(request(), { ...update, ...rebind }, original)).rejects.toMatchObject({ status: 400 })
  })
})
