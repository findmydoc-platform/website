import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import {
  prepareCommittedClinicInvitations,
  requestInitialClinicInvitation,
} from '@/auth/actions/clinicInvitationRequests'

const mocks = vi.hoisted(() => ({ environment: vi.fn(), activation: vi.fn(), reserve: vi.fn(), bind: vi.fn() }))
vi.mock('@/features/transactionalEmail/environment', () => ({
  resolveTransactionalEmailEnvironment: mocks.environment,
}))
vi.mock('@/features/transactionalEmail/activationPolicy', () => ({
  isTransactionalEmailCommandActivationDeclared: mocks.activation,
}))
vi.mock('@/auth/actions/lifecycle', () => ({ bindAuthActions: mocks.bind }))

function request() {
  return { context: {}, payload: { find: vi.fn().mockResolvedValue({ docs: [] }), logger: { error: vi.fn() } } }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.environment.mockReturnValue('preview')
  mocks.activation.mockReturnValue(true)
  mocks.bind.mockReturnValue({ reserveClinicInvitation: mocks.reserve })
  mocks.reserve.mockImplementation(async ({ clinicStaffId }) => ({ id: clinicStaffId }))
})

describe('committed clinic invitation preparation', () => {
  it('does no work before activation, and never borrows the approval transaction', async () => {
    const req = request() as unknown as PayloadRequest
    mocks.activation.mockReturnValue(false)
    expect(await requestInitialClinicInvitation(req, 61)).toBe('inactive')
    await prepareCommittedClinicInvitations(req, { deadline: 100000, now: () => 0 })
    expect(req.payload.find).not.toHaveBeenCalled()
    expect(mocks.bind).not.toHaveBeenCalled()
    mocks.activation.mockReturnValue(true)
    req.transactionID = Promise.resolve('approval')
    expect(await requestInitialClinicInvitation(req, 61)).toBe('deferred')
    expect(mocks.bind).not.toHaveBeenCalled()
  })

  it('reserves through the current environment with IDs only after commit', async () => {
    const req = request() as unknown as PayloadRequest
    expect(await requestInitialClinicInvitation(req, 61)).toBe('prepared')
    expect(mocks.bind).toHaveBeenCalledWith(req, { environment: 'preview' })
    expect(mocks.reserve).toHaveBeenCalledWith({ clinicStaffId: 61 })
    mocks.reserve.mockResolvedValue(null)
    expect(await requestInitialClinicInvitation(req, 61)).toBe('ineligible')
  })

  it('excludes previously authorized sources even after their action history has been retained away', async () => {
    const req = request()
    const sources = [{ id: 61, invitationAuthorizedAt: '2026-01-01T00:00:00.000Z' }]
    req.payload.find.mockImplementation(async ({ where }) => {
      expect(where.and).toEqual([
        { id: { greater_than: 0 } },
        { status: { equals: 'approved' } },
        { 'authSync.status': { equals: 'synced' } },
        { invitationAuthorizedAt: { exists: false } },
        { invitationAttemptedAt: { exists: false } },
        { 'accountCompletion.source': { exists: false } },
        { 'legacyAccess.eligibleAt': { exists: false } },
        { onboardingKey: { like: 'clinic-application:' } },
      ])
      const excludesAuthorized = where.and.some(
        (condition: { invitationAuthorizedAt?: { exists?: boolean } }) =>
          condition.invitationAuthorizedAt?.exists === false,
      )
      return { docs: excludesAuthorized ? sources.filter((source) => !source.invitationAuthorizedAt) : sources }
    })
    await prepareCommittedClinicInvitations(req as unknown as PayloadRequest, {
      deadline: 100000,
      now: () => 0,
    })
    expect(mocks.reserve).not.toHaveBeenCalled()
  })

  it('pages past ineligible sources and continues independent sources after a safe failure', async () => {
    const req = request()
    req.payload.find
      .mockResolvedValueOnce({ docs: Array.from({ length: 25 }, (_, i) => ({ id: i + 1 })) })
      .mockResolvedValueOnce({ docs: [{ id: 26 }, { id: 27 }] })
    mocks.reserve.mockResolvedValue(null)
    mocks.reserve.mockRejectedValueOnce(new Error('private provider detail'))
    await expect(
      prepareCommittedClinicInvitations(req as unknown as PayloadRequest, {
        deadline: 100000,
        now: () => 0,
      }),
    ).rejects.toThrow('Clinic invitation preparation unavailable.')
    expect(mocks.reserve).toHaveBeenLastCalledWith({ clinicStaffId: 27 })
    expect(req.payload.find.mock.calls[1]?.[0]).toMatchObject({
      where: { and: expect.arrayContaining([{ id: { greater_than: 25 } }]) },
    })
    expect(JSON.stringify(req.payload.logger.error.mock.calls)).not.toContain('private provider detail')
  })

  it('stops new preparation at the request deadline or after 25 successful reservations', async () => {
    const req = request()
    req.payload.find.mockResolvedValue({ docs: Array.from({ length: 25 }, (_, i) => ({ id: i + 1 })) })
    await prepareCommittedClinicInvitations(req as unknown as PayloadRequest, { deadline: 100000, now: () => 0 })
    expect(mocks.reserve).toHaveBeenCalledTimes(25)
    expect(req.payload.find).toHaveBeenCalledOnce()
    vi.clearAllMocks()
    let now = 0
    req.payload.find.mockImplementation(async () => {
      now = 30000
      return { docs: [{ id: 61 }] }
    })
    await prepareCommittedClinicInvitations(req as unknown as PayloadRequest, { deadline: 100000, now: () => now })
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
})
