import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { requestPasswordRecovery, prepareCommittedRecoveries } from '@/auth/actions/passwordRecoveryRequests'
const mocks = vi.hoisted(() => ({
  environment: vi.fn(),
  activation: vi.fn(),
  keys: vi.fn(),
  bind: vi.fn(),
  transition: vi.fn(),
  live: vi.fn(),
  reserve: vi.fn(),
  accept: vi.fn(),
  email: vi.fn(),
  localReq: vi.fn(),
}))
vi.mock('@/features/transactionalEmail/environment', () => ({
  resolveTransactionalEmailEnvironment: mocks.environment,
}))
vi.mock('@/features/transactionalEmail/payloadIntegration', () => ({
  selectTransactionalEmailCommandAcceptance: mocks.activation,
  bindTransactionalEmail: mocks.email,
}))
vi.mock('@/auth/actions/recoveryConfiguration', () => ({ resolveRecoveryKeys: mocks.keys }))
vi.mock('@/auth/actions/lifecycle', () => ({ bindAuthActions: mocks.bind }))
vi.mock('payload', async (load) => ({ ...(await load<typeof import('payload')>()), createLocalReq: mocks.localReq }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.environment.mockReturnValue('preview')
  mocks.activation.mockReturnValue({ kind: 'active' })
  mocks.keys.mockReturnValue([])
  mocks.bind.mockReturnValue({
    reserveRecovery: mocks.reserve,
    liveRecoveries: mocks.live,
    transition: mocks.transition,
  })
  mocks.transition.mockImplementation(async ({ id }) => ({ id, state: 'active' }))
  mocks.live.mockResolvedValue([])
  mocks.email.mockReturnValue({ accept: mocks.accept })
  mocks.accept.mockResolvedValue({ deduplicated: false })
})
const req = () => ({ payload: { logger: { error: vi.fn() } }, context: {}, user: null }) as unknown as PayloadRequest

describe('bounded committed recovery command acceptance', () => {
  it('does no work when the hosted command activation is absent', async () => {
    mocks.activation.mockReturnValue({ kind: 'inactive' })
    await requestPasswordRecovery(req(), { email: 'person@example.test', context: null })
    await prepareCommittedRecoveries(req(), { deadline: 100000, now: () => 0 })
    expect(mocks.bind).not.toHaveBeenCalled()
    expect(mocks.keys).not.toHaveBeenCalled()
    expect(mocks.accept).not.toHaveBeenCalled()
  })
  it('pages past 25 old duplicate receipts to recover a newer interrupted acceptance', async () => {
    mocks.live
      .mockResolvedValueOnce(Array.from({ length: 25 }, (_, index) => ({ id: index + 1, state: 'active' })))
      .mockResolvedValueOnce([{ id: 26, state: 'pending' }])
    mocks.accept.mockImplementation(async ({ authActionId }) => ({ deduplicated: authActionId <= 25 }))
    await prepareCommittedRecoveries(req(), { deadline: 100000, now: () => 0 })
    expect(mocks.live).toHaveBeenNthCalledWith(1, { afterId: 0, limit: 25 })
    expect(mocks.live).toHaveBeenNthCalledWith(2, { afterId: 25, limit: 25 })
    expect(mocks.transition).toHaveBeenCalledWith({ id: 26, to: 'active' })
    expect(mocks.accept).toHaveBeenCalledWith({ type: 'auth.password-recovery', authActionId: 26 })
  })
  it('limits new acceptances to 25 and stops at the deadline before any attempt', async () => {
    mocks.live.mockResolvedValue(Array.from({ length: 25 }, (_, index) => ({ id: index + 1, state: 'active' })))
    await prepareCommittedRecoveries(req(), { deadline: 100000, now: () => 0 })
    expect(mocks.accept).toHaveBeenCalledTimes(25)
    expect(mocks.live).toHaveBeenCalledOnce()
    vi.clearAllMocks()
    await prepareCommittedRecoveries(req(), { deadline: 0, now: () => 0 })
    expect(mocks.live).not.toHaveBeenCalled()
    expect(mocks.accept).not.toHaveBeenCalled()
  })
  it('continues independent actions after a content-free failure and reports invocation failure', async () => {
    const request = req()
    mocks.live.mockResolvedValueOnce([
      { id: 1, state: 'active' },
      { id: 2, state: 'active' },
    ])
    mocks.accept.mockRejectedValueOnce(new Error('Private recipient/provider detail'))
    await expect(prepareCommittedRecoveries(request, { deadline: 100000, now: () => 0 })).rejects.toThrow(
      'Recovery command acceptance unavailable.',
    )
    expect(mocks.accept).toHaveBeenCalledWith({ type: 'auth.password-recovery', authActionId: 2 })
    expect(JSON.stringify(vi.mocked(request.payload.logger.error).mock.calls)).not.toContain(
      'Private recipient/provider detail',
    )
  })
})
