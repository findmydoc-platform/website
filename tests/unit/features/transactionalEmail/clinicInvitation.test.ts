import { describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { AuthAction, ClinicStaff } from '@/payload-types'
import { createCommandPort } from '@/features/transactionalEmail/acceptance'
import { dispatchCommandPreparation } from '@/features/transactionalEmail/catalog'
import { createClinicInvitationCatalogEntry } from '@/features/transactionalEmail/clinicInvitation'
import { randomBytes } from 'node:crypto'
import { readActionReference, type AuthActionProtocolKeys } from '@/auth/actions/protocol/credentials'

const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const now = Date.parse('2026-10-03T12:00:00.000Z')
const email = 'clinic@example.test'

function fixture() {
  const keys: AuthActionProtocolKeys = {
    environment: 'test',
    service: [{ version: 'offline', secret: randomBytes(32).toString('hex') }],
    reference: [{ version: 'offline', secret: randomBytes(32).toString('hex') }],
  }
  const action = {
    id: 43,
    actionType: 'clinic-invitation',
    state: 'active',
    environment: 'test',
    principal: { relationTo: 'clinicStaff', value: 61 },
    supabaseSubject: subject,
    callbackDestination: 'clinic-dashboard-auth-callback',
    finalDestination: 'clinic-dashboard',
    completionRoute: '/auth/invite/complete',
    supabaseTokenType: 'invite',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 86400000).toISOString(),
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
    created_at: new Date(now).toISOString(),
  } as User
  const admin = {
    getUserById: vi.fn(async () => ({ data: { user }, error: null })),
    generateLink: vi.fn(async () => ({
      data: { user, properties: { hashed_token: 'b'.repeat(56), verification_type: 'invite' } },
      error: null,
    })),
  }
  const entry = createClinicInvitationCatalogEntry({
    environment: 'test',
    now: () => now,
    actions: { read: async () => action },
    findPrincipal: async () => staff,
    admin: async () => admin as never,
    dashboardOrigin: () => 'https://dashboard.example.test',
    actionReferenceKeys: keys,
  })
  return { action, staff, user, admin, keys, catalog: { 'auth.invitation': entry } }
}

describe('clinic invitation command through the production catalog', () => {
  it.each([
    ['another environment', { environment: 'production' }],
    ['expired action', { expiresAt: new Date(now).toISOString() }],
    ['wrong callback', { callbackDestination: 'website-auth-callback' }],
    ['wrong completion', { completionRoute: '/admin' }],
    ['wrong type', { supabaseTokenType: 'magiclink' }],
    ['superseded action', { state: 'superseded' }],
    ['different action ID', { id: 44 }],
  ])('suppresses %s before asking Supabase for a link', async (_name, change) => {
    const { action, catalog, admin } = fixture()
    Object.assign(action, change)
    expect(await catalog['auth.invitation'].revalidate({ type: 'auth.invitation', authActionId: 43 })).toEqual({
      status: 'suppressed',
      outcomeCode: 'ineligible',
    })
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
            verification_type: change === 'token-type' ? 'magiclink' : 'invite',
            hashed_token: change === 'token-hash' ? 'invalid' : 'b'.repeat(56),
          },
        },
        error: null,
      })
      const decision = await catalog['auth.invitation'].revalidate({ type: 'auth.invitation', authActionId: 43 })
      if (decision.status !== 'eligible') throw new Error('Expected eligible action before provider reply.')
      await expect(decision.prepare()).rejects.toMatchObject({ code: 'source-missing' })
    },
  )

  it('accepts one action identity and renders the pinned clinic invitation template without native sending', async () => {
    const { catalog, admin, keys } = fixture()
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
    const command = { type: 'auth.invitation', authActionId: 43 } as const
    expect(await commands.accept(command)).toMatchObject({ operationId: '7', deduplicated: false })
    expect(await commands.accept(command)).toMatchObject({ operationId: '7', deduplicated: true })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|auth-action|43',
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
    if (decision.status !== 'eligible') throw new Error('Expected eligible invitation.')
    const prepared = await decision.prepare()
    expect(prepared.recipientAddress).toBe(email)
    expect(prepared.subject).toBe('Complete your findmydoc clinic invitation')
    const htmlLinks = [...prepared.html.matchAll(/href="([^"]+)"/g)].map(
      (match) => new URL(match[1]!.replaceAll('&amp;', '&')),
    )
    const callback = htmlLinks.find((link) => link.pathname === '/auth/callback')!
    expect(callback.origin).toBe('https://dashboard.example.test')
    expect([...callback.searchParams.entries()]).toEqual([
      ['authActionId', '43'],
      ['actionRef', callback.searchParams.get('actionRef')!],
      ['token_hash', 'b'.repeat(56)],
      ['type', 'invite'],
    ])
    expect(prepared.text).toContain(callback.toString())
    expect(readActionReference(callback.searchParams.get('actionRef')!, keys)).toEqual({
      version: 1,
      environment: 'test',
      actionId: 43,
      flow: 'clinic-invitation',
    })
    const redirect = new URL(callback)
    redirect.searchParams.delete('token_hash')
    redirect.searchParams.delete('type')
    expect(admin.generateLink).toHaveBeenCalledWith({
      type: 'invite',
      email,
      options: { redirectTo: redirect.toString() },
    })
  })
})
