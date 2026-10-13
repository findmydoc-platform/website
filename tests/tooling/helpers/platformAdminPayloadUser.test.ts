import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePlatformAdminPayloadUser } from '../../e2e/helpers/platformAdminPayloadUser'
import { toFixedAdminAccessError } from '../../e2e/helpers/adminSession'

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), getPayload: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { signInWithPassword: mocks.signIn } }) }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))

const credentials = { email: 'diagnostic-fixture@findmydoc.eu', password: 'fixture-password-do-not-log' }
const sensitive = [
  'fixture-password-do-not-log',
  'diagnostic-fixture@findmydoc.eu',
  'fixture-api-key-do-not-log',
  'https://fixture.invalid',
  'fixture-access-token-do-not-log',
]

const captureFailure = async () => {
  try {
    await ensurePlatformAdminPayloadUser(credentials)
  } catch (error) {
    return toFixedAdminAccessError(error)
  }
  throw new Error('Expected authentication to fail')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.invalid')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fixture-api-key-do-not-log')
})
afterEach(() => vi.unstubAllEnvs())

describe('admin setup authentication diagnostics', () => {
  it.each([
    ['invalid_credentials', 400],
    ['email_not_confirmed', 400],
    ['over_request_rate_limit', 429],
  ])('preserves safe API diagnostics for %s before Payload synchronization', async (code, status) => {
    mocks.signIn.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', code, status, message: sensitive.join(' ') },
    })
    const error = await captureFailure()
    expect(error.message).toContain('phase=supabase-signin')
    expect(error.message).toContain(`status=${status}`)
    expect(error.message).toContain(`code=${code}`)
    expect(error.message).toContain('type=AuthApiError')
    for (const value of sensitive) expect(error.message).not.toContain(value)
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })

  it('reports thrown network errors without preserving sensitive causes', async () => {
    mocks.signIn.mockRejectedValue(
      Object.assign(new Error(sensitive.join(' ')), {
        name: 'AuthRetryableFetchError',
        status: 503,
        cause: sensitive.join(' '),
      }),
    )
    const error = await captureFailure()
    expect(error.message).toContain('type=AuthRetryableFetchError status=503 code=unknown')
    expect(String(error.cause)).not.toContain(sensitive[0])
    for (const value of sensitive) expect(error.message).not.toContain(value)
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })

  it('distinguishes a missing user response from an API rejection', async () => {
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: null })
    expect((await captureFailure()).message).toContain('code=missing_user')
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })

  it('rejects unrecognized diagnostic values instead of logging their content', async () => {
    mocks.signIn.mockResolvedValue({
      data: { user: null },
      error: { name: sensitive[0], status: sensitive[1], code: sensitive[2], message: sensitive[3] },
    })
    const error = await captureFailure()
    expect(error.message).toContain('type=unknown status=unknown code=unknown')
    for (const value of sensitive) expect(error.message).not.toContain(value)
  })

  it('continues synchronizing a successfully authenticated platform admin', async () => {
    mocks.signIn.mockResolvedValue({
      data: {
        user: {
          id: 'fixture-user',
          email: credentials.email,
          app_metadata: { user_type: 'platform' },
          user_metadata: {},
        },
      },
      error: null,
    })
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 1, firstName: 'Test', lastName: 'Admin' }] }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
    }
    mocks.getPayload.mockResolvedValue(payload)
    await ensurePlatformAdminPayloadUser(credentials)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'platformStaff',
        data: expect.objectContaining({ role: 'admin', supabaseUserId: 'fixture-user' }),
      }),
    )
  })
})
