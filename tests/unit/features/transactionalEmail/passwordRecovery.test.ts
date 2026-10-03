import { describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { AuthAction, Patient } from '@/payload-types'
import { recoveryCorrelations } from '@/auth/actions/recoveryCorrelation'
import { dispatchCommandPreparation } from '@/features/transactionalEmail/catalog'
import { createPasswordRecoveryCatalogEntry } from '@/features/transactionalEmail/passwordRecovery'

const now = Date.parse('2026-10-03T12:00:00.000Z')
const email = 'patient@example.test'
const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const key = { version: 'offline-v1', secret: 'offline-only-recovery-correlation-material' } // pragma: allowlist secret
function fixture(signal?: AbortSignal) {
  const correlation = recoveryCorrelations(email, '', 'test', [key])[0]!.correlations[0]!
  const action = {
    id: 45,
    actionType: 'patient-recovery',
    state: 'active',
    environment: 'test',
    principal: { relationTo: 'patients', value: 61 },
    principalBoundAt: new Date(now).toISOString(),
    supabaseSubject: subject,
    subjectBoundAt: new Date(now).toISOString(),
    correlationDigest: correlation.digest,
    correlationKeyVersion: correlation.keyVersion,
    callbackDestination: 'website-auth-callback',
    completionRoute: '/auth/password/reset/complete',
    finalDestination: 'patient-inquiries',
    supabaseTokenType: 'recovery',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3600000).toISOString(),
  } as AuthAction
  const principal = { id: 61, email, supabaseUserId: subject } as Patient
  const user = {
    id: subject,
    email,
    email_confirmed_at: new Date(now).toISOString(),
    app_metadata: { user_type: 'patient' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date(now).toISOString(),
  } as User
  const admin = {
    getUserById: vi.fn(async () => ({ data: { user }, error: null })),
    generateLink: vi.fn(async () => ({
      data: { user, properties: { hashed_token: 'c'.repeat(64), verification_type: 'recovery' } },
      error: null,
    })),
  }
  const entry = createPasswordRecoveryCatalogEntry({
    environment: 'test',
    signal,
    now: () => now,
    recoveryKeys: [key],
    actions: { read: async () => action },
    findPrincipal: async () => ({
      collection: 'patients',
      actionType: 'patient-recovery',
      userType: 'patient',
      document: principal,
    }),
    admin: async () => admin as never,
    dashboardOrigin: () => 'https://dashboard.example.test',
  })
  return { action, principal, user, admin, catalog: { 'auth.password-recovery': entry } }
}

describe('password recovery through the authorized command catalog', () => {
  it('stops acceptance when its lookup completes after the scheduler aborts', async () => {
    const controller = new AbortController()
    const { catalog, admin, user } = fixture(controller.signal)
    admin.getUserById.mockImplementationOnce(async () => {
      controller.abort(new Error('Recovery command acceptance unavailable.'))
      return { data: { user }, error: null }
    })
    await expect(
      catalog['auth.password-recovery'].authorizeAndResolve({ type: 'auth.password-recovery', authActionId: 45 }, null),
    ).rejects.toThrow('Recovery command acceptance unavailable.')
    expect(admin.generateLink).not.toHaveBeenCalled()
  })
  it('renders a usable action-owned patient recovery link with only the package actionUrl prop', async () => {
    const { catalog, admin } = fixture()
    const command = { type: 'auth.password-recovery', authActionId: 45 } as const
    const recipient = await catalog[command.type].authorizeAndResolve(command, null)
    const decision = await dispatchCommandPreparation({
      catalog,
      command,
      storedRecipientAddress: recipient.address,
      storedRecipientDigest: recipient.binding,
      digestRecipient: (current) => current.binding,
    })
    if (decision.status !== 'eligible') throw new Error('Expected eligible recovery.')
    const message = await decision.prepare()
    expect(message.subject).toBe('Reset your findmydoc patient password')
    expect(message.recipientAddress).toBe(email)
    const links = [...message.html.matchAll(/href="([^"]+)"/g)].map(
      (match) => new URL(match[1]!.replaceAll('&amp;', '&')),
    )
    const callback = links.find((link) => link.pathname === '/auth/callback')!
    expect(callback.origin).toBe('https://example.test')
    expect([...callback.searchParams.entries()]).toEqual([
      ['authActionId', '45'],
      ['next', '/auth/password/reset/complete'],
      ['token_hash', 'c'.repeat(64)],
      ['type', 'recovery'],
    ])
    expect(message.text).toContain(callback.toString())
    expect(admin.generateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://example.test/auth/callback?authActionId=45&next=%2Fauth%2Fpassword%2Freset%2Fcomplete',
      },
    })
  })
  it.each([
    ['environment', { environment: 'production' }],
    ['expiry', { expiresAt: new Date(now).toISOString() }],
    ['superseded', { state: 'superseded' }],
    ['revoked', { state: 'revoked' }],
    ['unsupported action', { actionType: 'clinic-invitation' }],
    ['unsupported principal', { principal: { relationTo: 'clinicStaff', value: 61 } }],
    ['subject binding', { supabaseSubject: null }],
    ['subject timestamp', { subjectBoundAt: null }],
    ['principal timestamp', { principalBoundAt: null }],
    ['callback', { callbackDestination: 'clinic-dashboard-auth-callback' }],
    ['completion', { completionRoute: '/admin' }],
    ['destination', { finalDestination: 'platform-administration' }],
    ['token type', { supabaseTokenType: 'invite' }],
    ['original recipient', { correlationDigest: 'd'.repeat(64) }],
  ])('suppresses invalid %s before link generation', async (_name, change) => {
    const { action, catalog, admin } = fixture()
    Object.assign(action, change)
    expect(
      await catalog['auth.password-recovery'].revalidate({ type: 'auth.password-recovery', authActionId: 45 }),
    ).toEqual({ status: 'suppressed', outcomeCode: 'ineligible' })
    expect(admin.generateLink).not.toHaveBeenCalled()
  })

  it.each(['user-type', 'user-metadata', 'banned', 'email', 'subject'])(
    'rejects current Supabase %s without trusting user-editable metadata',
    async (reason) => {
      const { user, catalog, admin } = fixture()
      if (reason === 'user-type') user.app_metadata.user_type = 'platform'
      if (reason === 'user-metadata') {
        user.app_metadata = {}
        user.user_metadata = { user_type: 'patient' }
      }
      if (reason === 'banned') user.banned_until = new Date(now + 60000).toISOString()
      if (reason === 'email') user.email = 'changed@example.test'
      if (reason === 'subject') user.id = '25196744-bfa8-4947-b341-93df2879220f'
      expect(
        await catalog['auth.password-recovery'].revalidate({ type: 'auth.password-recovery', authActionId: 45 }),
      ).toEqual({ status: 'suppressed', outcomeCode: 'ineligible' })
      expect(admin.generateLink).not.toHaveBeenCalled()
    },
  )

  it.each(['subject', 'email', 'token-type', 'token-hash'])(
    'rejects a generated recovery link with mismatched %s',
    async (reason) => {
      const { catalog, admin, user } = fixture()
      admin.generateLink.mockResolvedValueOnce({
        data: {
          user: {
            ...user,
            ...(reason === 'subject' ? { id: '25196744-bfa8-4947-b341-93df2879220f' } : {}),
            ...(reason === 'email' ? { email: 'changed@example.test' } : {}),
          },
          properties: {
            verification_type: reason === 'token-type' ? 'invite' : 'recovery',
            hashed_token: reason === 'token-hash' ? 'invalid' : 'c'.repeat(64),
          },
        },
        error: null,
      })
      const decision = await catalog['auth.password-recovery'].revalidate({
        type: 'auth.password-recovery',
        authActionId: 45,
      })
      if (decision.status !== 'eligible') throw new Error('Expected eligible recovery before provider reply.')
      await expect(decision.prepare()).rejects.toMatchObject({ code: 'source-missing' })
    },
  )

  it('rechecks the original recipient immediately before preparation', async () => {
    const { principal, catalog, admin } = fixture()
    const decision = await catalog['auth.password-recovery'].revalidate({
      type: 'auth.password-recovery',
      authActionId: 45,
    })
    if (decision.status !== 'eligible') throw new Error('Expected eligible recovery.')
    principal.email = 'changed@example.test'
    await expect(decision.prepare()).rejects.toMatchObject({ code: 'source-missing' })
    expect(admin.generateLink).not.toHaveBeenCalled()
  })
})
