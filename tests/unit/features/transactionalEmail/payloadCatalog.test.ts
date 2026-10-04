import { randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { AuthAction, ClinicStaff } from '@/payload-types'
import { dispatchCommandPreparation } from '@/features/transactionalEmail/catalog'
import { bindPayloadCommandCatalog } from '@/features/transactionalEmail/payloadCatalog'
import { readActionReference } from '@/auth/actions/protocol/credentials'

const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const email = 'clinic@example.test'
const createdAt = new Date(Date.now() - 1000).toISOString()
const expiresAt = new Date(Date.parse(createdAt) + 86400000).toISOString()

const mocks = vi.hoisted(() => ({
  bindAuthActions: vi.fn(),
  createAdminClient: vi.fn(),
  createLocalReq: vi.fn(),
  findClinicInvitationPrincipal: vi.fn(),
}))

vi.mock('payload', () => ({
  createLocalReq: mocks.createLocalReq,
}))

vi.mock('@/auth/actions/lifecycle', () => ({
  bindAuthActions: mocks.bindAuthActions,
}))

vi.mock('@/auth/actions/clinicInvitationPrincipal', () => ({
  findClinicInvitationPrincipal: mocks.findClinicInvitationPrincipal,
}))

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: mocks.createAdminClient,
}))

function fixture() {
  const action = {
    id: 43,
    actionType: 'clinic-invitation',
    callbackDestination: 'clinic-dashboard-auth-callback',
    completionRoute: '/auth/invite/complete',
    createdAt,
    environment: 'ci',
    expiresAt,
    finalDestination: 'clinic-dashboard',
    principal: { relationTo: 'clinicStaff', value: 61 },
    state: 'active',
    supabaseSubject: subject,
    supabaseTokenType: 'invite',
  } as AuthAction
  const staff = {
    id: 61,
    email,
    onboardingKey: 'clinic-application:81',
    supabaseUserId: subject,
  } as ClinicStaff
  const user = {
    id: subject,
    email,
    app_metadata: { user_type: 'clinic', onboarding_key: 'clinic-application:81' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: createdAt,
  } as User
  const admin = {
    getUserById: vi.fn(async () => ({ data: { user }, error: null })),
    generateLink: vi.fn(async (_input: unknown) => ({
      data: { user, properties: { hashed_token: 'd'.repeat(64), verification_type: 'invite' } },
      error: null,
    })),
  }
  const payload = {}
  const sourceReq = { payload }
  mocks.createLocalReq.mockResolvedValue(sourceReq)
  mocks.bindAuthActions.mockReturnValue({ read: vi.fn(async () => action) })
  mocks.findClinicInvitationPrincipal.mockResolvedValue(staff)
  mocks.createAdminClient.mockResolvedValue({ auth: { admin } })
  return { action, admin, payload, sourceReq, staff }
}

describe('payload transactional email catalog wiring', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('routes auth.invitation through the static Payload catalog and prepares the clinic invitation', async () => {
    vi.stubEnv('CI', 'true')
    const keys = {
      environment: 'ci' as const,
      service: [{ version: 'current', secret: randomBytes(32).toString('hex') }],
      reference: [{ version: 'current', secret: randomBytes(32).toString('hex') }],
    }
    vi.stubEnv('AUTH_ACTION_PROTOCOL_KEYS_JSON', JSON.stringify(keys))
    vi.stubEnv('CLINIC_DASHBOARD_URL', 'https://dashboard.findmydoc.test')
    const { action, admin, payload, sourceReq } = fixture()
    const catalog = bindPayloadCommandCatalog({ payload } as never)
    const command = { type: 'auth.invitation' as const, authActionId: action.id }
    const recipient = await catalog['auth.invitation']!.authorizeAndResolve(command, null)

    const decision = await dispatchCommandPreparation({
      catalog,
      command,
      digestRecipient: (current) => current.binding,
      storedRecipientAddress: recipient.address,
      storedRecipientDigest: recipient.binding,
    })

    expect(decision.status).toBe('eligible')
    if (decision.status !== 'eligible') throw new Error('Expected eligible clinic invitation.')
    const prepared = await decision.prepare()
    expect(prepared.recipientAddress).toBe(email)
    expect(prepared.subject).toBe('Complete your findmydoc clinic invitation')
    expect(mocks.createLocalReq).toHaveBeenCalledWith({}, payload)
    expect(mocks.bindAuthActions).toHaveBeenCalledWith(sourceReq, { environment: 'ci' })
    expect(mocks.findClinicInvitationPrincipal).toHaveBeenCalledWith(sourceReq, 61)
    const generated = admin.generateLink.mock.calls[0]![0] as unknown as {
      type: string
      email: string
      options: { redirectTo: string }
    }
    const callback = new URL(generated.options.redirectTo)
    expect(generated).toMatchObject({ type: 'invite', email })
    expect(callback.origin).toBe('https://dashboard.findmydoc.test')
    expect(callback.searchParams.get('authActionId')).toBe(String(action.id))
    expect(readActionReference(callback.searchParams.get('actionRef')!, keys)).toEqual({
      version: 1,
      actionId: action.id,
      flow: 'clinic-invitation',
      environment: 'ci',
    })
  })
})
