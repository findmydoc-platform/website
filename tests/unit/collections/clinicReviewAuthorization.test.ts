import { beforeEach, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { prepareReviewResponseChange } from '@/collections/reviewWorkflow'
import {
  prepareReviewResponseNotificationOperation,
  finalizeReviewDecisionNotificationOperation,
} from '@/collections/reviews/decisionNotifications'
const mocks = vi.hoisted(() => ({ principal: vi.fn(), target: vi.fn(), guard: vi.fn(), session: vi.fn() }))
vi.mock('@/auth/utilities/clinicPrincipalAccess', () => ({
  readClinicPrincipalAccess: mocks.principal,
  readClinicTargetAccess: mocks.target,
}))
vi.mock('@/features/clinicNotifications/capture', () => ({
  prepareClinicNotificationCapture: vi.fn(),
  captureClinicNotificationOccurrence: vi.fn(),
}))
vi.mock('@/features/clinicNotifications/diagnostics', () => ({ recordNotificationDiagnostic: vi.fn() }))
vi.mock('@/features/clinicNotifications/authorizationBarrier', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicNotifications/authorizationBarrier')>()),
  guardClinicAuthorizationKeys: mocks.guard,
  guardNotificationAuthorizationSession: mocks.session,
  lockNotificationAuthorization: vi.fn(),
}))
function request() {
  return {
    user: { id: 7, collection: 'clinicStaff' },
    transactionID: 'tx',
    context: {},
    payload: {
      db: { sessions: { tx: {} } },
      find: vi.fn(async () => ({ docs: [] })),
      findByID: vi.fn(async () => ({ id: 204, clinic: 42, status: 'approved' })),
    },
  } as unknown as PayloadRequest
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.principal.mockResolvedValue({ staff: { id: 7, assignmentScope: 'group', group: 9 }, clinics: [{ id: 42 }] })
  mocks.target.mockResolvedValue({ staff: { id: 7 }, clinic: { id: 42 } })
})
it('allows a current group member to submit the existing pending response under clinic, group and personal barriers', async () => {
  const req = request()
  await prepareReviewResponseNotificationOperation({
    req,
    operation: 'create',
    args: { data: { review: 204 } },
  } as never)
  expect(mocks.guard).toHaveBeenCalledWith(
    req,
    expect.arrayContaining([
      'notification-authorization:clinic:42',
      'notification-authorization:group:9',
      'notification-authorization:staff:7',
    ]),
  )
  await expect(
    prepareReviewResponseChange({
      req,
      operation: 'create',
      data: { review: 204, pendingResponse: { body: 'Authorized group response.' } },
    } as never),
  ).resolves.toMatchObject({
    clinic: 42,
    review: 204,
    moderationStatus: 'pending',
    pendingResponse: { body: 'Authorized group response.' },
    lastActorType: 'clinic_staff',
  })
})
it('rejects a changed path target and fails final native authorization before commit even with capture inactive', async () => {
  const req = request()
  await prepareReviewResponseNotificationOperation({
    req,
    operation: 'create',
    args: { data: { review: 204 } },
  } as never)
  req.routeParams = { clinicId: '99' }
  await expect(
    prepareReviewResponseChange({
      req,
      operation: 'create',
      data: { review: 204, pendingResponse: { body: 'Wrong target response.' } },
    } as never),
  ).rejects.toMatchObject({ status: 403 })
  req.routeParams = { clinicId: '42' }
  mocks.target.mockResolvedValue(null)
  await expect(
    finalizeReviewDecisionNotificationOperation({
      req,
      operation: 'create',
      result: { id: 301, clinic: 42, review: 204 },
    } as never),
  ).rejects.toMatchObject({ status: 403 })
})
