import { describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { AuthAction } from '@/payload-types'
import { verificationCorrelations } from '@/auth/actions/verificationCorrelation'
import { createCommandPort } from '@/features/transactionalEmail/acceptance'
import { dispatchCommandPreparation } from '@/features/transactionalEmail/catalog'
import { createPatientVerificationCatalogEntry } from '@/features/transactionalEmail/patientVerification'

const key = { version: 'offline-v1', secret: 'offline-only-patient-verification-test-key' } // pragma: allowlist secret
const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const now = Date.parse('2026-10-03T12:00:00.000Z')
const email = 'patient@example.test'

function fixture() {
  const action = {
    id: 41,
    actionType: 'patient-verification',
    state: 'active',
    environment: 'test',
    supabaseSubject: subject,
    callbackDestination: 'website-auth-callback',
    finalDestination: 'patient-inquiries',
    completionRoute: '/patient/inquiries',
    supabaseTokenType: 'magiclink',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 86400000).toISOString(),
    ...verificationCorrelations(email, 'test', [key])[0],
  } as AuthAction
  const user = {
    id: subject,
    email,
    app_metadata: { user_type: 'patient' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date(now).toISOString(),
  } as User
  const admin = {
    getUserById: vi.fn(async () => ({ data: { user }, error: null })),
    generateLink: vi.fn(async () => ({
      data: { user, properties: { hashed_token: 'a'.repeat(64), verification_type: 'magiclink' } },
      error: null,
    })),
  }
  const entry = createPatientVerificationCatalogEntry({
    environment: 'test',
    now: () => now,
    verificationKeys: [key],
    actions: { read: async () => action },
    admin: async () => admin as never,
  })
  return { action, user, admin, catalog: { 'auth.email-verification': entry } }
}

describe('patient verification command through the production catalog', () => {
  it.each([
    ['another environment', { environment: 'production' }],
    ['expired action', { expiresAt: new Date(now).toISOString() }],
    ['wrong callback', { callbackDestination: 'clinic-dashboard-auth-callback' }],
    ['wrong completion', { completionRoute: '/admin' }],
    ['wrong type', { supabaseTokenType: 'recovery' }],
    ['superseded action', { state: 'superseded' }],
    ['different action ID', { id: 42 }],
  ])('suppresses %s before asking Supabase for a link', async (_name, change) => {
    const { action, catalog, admin } = fixture()
    Object.assign(action, change)
    expect(
      await catalog['auth.email-verification'].revalidate({ type: 'auth.email-verification', authActionId: 41 }),
    ).toEqual({ status: 'suppressed', outcomeCode: 'ineligible' })
    expect(admin.getUserById).not.toHaveBeenCalled()
    expect(admin.generateLink).not.toHaveBeenCalled()
  })

  it.each(['subject', 'recipient', 'token-type', 'token-hash'])(
    'rejects a generated link with mismatched %s',
    async (change) => {
      const { catalog, admin, user } = fixture()
      admin.generateLink.mockResolvedValueOnce({
        data: {
          user: {
            ...user,
            ...(change === 'subject' ? { id: '25196744-bfa8-4947-b341-93df2879220f' } : {}),
            ...(change === 'recipient' ? { email: 'other@example.test' } : {}),
          },
          properties: {
            verification_type: change === 'token-type' ? 'recovery' : 'magiclink',
            hashed_token: change === 'token-hash' ? 'invalid' : 'a'.repeat(64),
          },
        },
        error: null,
      })
      const decision = await catalog['auth.email-verification'].revalidate({
        type: 'auth.email-verification',
        authActionId: 41,
      })
      if (decision.status !== 'eligible') throw new Error('Expected eligible action before provider reply.')
      await expect(decision.prepare()).rejects.toMatchObject({ code: 'source-missing' })
    },
  )

  it('accepts one action identity and renders the pinned verification template without native sending', async () => {
    const { catalog, admin } = fixture()
    const created: unknown[] = []
    const commands = createCommandPort({
      actor: null,
      environment: 'test',
      catalog,
      now: () => now,
      digestRecipient: () => 'offline-digest',
      transaction: async (work) =>
        work({
          find: async () => (created.length ? { id: 7, createdAt: new Date(now).toISOString() } : null),
          create: async (operation) => {
            created.push(operation)
            return { id: 7, createdAt: operation.acceptedAt }
          },
        }),
    })
    const command = { type: 'auth.email-verification', authActionId: 41 } as const
    expect(await commands.accept(command)).toMatchObject({ operationId: '7', deduplicated: false })
    expect(await commands.accept(command)).toMatchObject({ operationId: '7', deduplicated: true })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|auth-action|41',
        recipientAddress: email,
        deliveryDeadline: '2026-10-04T11:55:00.000Z',
      }),
    ])
    expect(admin.generateLink).not.toHaveBeenCalled()
    const decision = await dispatchCommandPreparation({
      catalog,
      command,
      storedRecipientAddress: email,
      storedRecipientDigest: 'offline-digest',
      digestRecipient: () => 'offline-digest',
    })
    expect(decision.status).toBe('eligible')
    if (decision.status !== 'eligible') throw new Error('Expected eligible verification.')
    const prepared = await decision.prepare()
    expect(prepared.recipientAddress).toBe(email)
    expect(prepared.subject).toBe('Verify your email for findmydoc')
    const htmlLinks = [...prepared.html.matchAll(/href="([^"]+)"/g)].map(
      (match) => new URL(match[1]!.replaceAll('&amp;', '&')),
    )
    const callback = htmlLinks.find((link) => link.pathname === '/auth/callback')!
    expect(callback.origin).toBe('https://example.test')
    expect([...callback.searchParams.entries()]).toEqual([
      ['authActionId', '41'],
      ['token_hash', 'a'.repeat(64)],
      ['type', 'magiclink'],
    ])
    expect(prepared.text).toContain(callback.toString())
    expect(admin.generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email,
      options: { redirectTo: 'https://example.test/auth/callback?authActionId=41' },
    })
  })
})
