import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import type { ClinicStaff } from '@/payload-types'
import {
  establishLegacyClinicPasswordEvidence,
  guardClinicAccountEvidence,
  importLegacyClinicPasswordEvidence,
  recordClinicInitialPasswordCompletion,
} from '@/auth/utilities/clinicAccountCompletion'

const provider = vi.hoisted(() => ({ getUser: vi.fn(), getClaims: vi.fn(), readAction: vi.fn() }))
vi.mock('@/auth/utilities/supaBaseServer', () => ({ createClient: async () => ({ auth: provider }) }))
vi.mock('@/auth/actions/lifecycle', () => ({ bindAuthActions: () => ({ read: provider.readAction }) }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  createLocalReq: async (_input: unknown, payload: unknown) => ({ payload, context: {} }),
}))

const subject = '00000000-0000-4000-8000-000000000022'
const snapshotAt = '2026-10-03T07:00:00.000Z'
const staff = {
  id: 22,
  collection: 'clinicStaff',
  clinic: 8,
  email: 'clinic@example.com',
  status: 'approved',
  supabaseUserId: subject,
  authSync: { status: 'synced' },
  createdAt: '2026-10-01T00:00:00.000Z',
  legacyAccess: { eligibleAt: snapshotAt, subject, clinicId: '8', initialParticipant: true },
} as ClinicStaff
const clinic = { id: 8, name: 'Example Clinic', status: 'pending', participationStatus: 'approved' }

function request() {
  const payload = createMockPayload()
  payload.findByID.mockImplementation(async ({ collection }) => (collection === 'clinics' ? clinic : staff))
  payload.update.mockImplementation(async ({ data }) => ({ ...staff, ...data }))
  return createMockReq(null, payload, { headers: new Headers({ Authorization: 'Bearer verified-token' }) })
}

describe('clinic password evidence boundary', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'))
    vi.clearAllMocks()
    provider.getUser.mockResolvedValue({
      data: { user: { id: subject, email: staff.email, app_metadata: { user_type: 'clinic' } } },
      error: null,
    })
    provider.getClaims.mockResolvedValue({
      data: { claims: { sub: subject, amr: [{ method: 'password', timestamp: Date.now() / 1000 }] } },
      error: null,
    })
  })

  it('records current password usability for a snapshotted initial legacy participant', async () => {
    const req = request()
    const result = await establishLegacyClinicPasswordEvidence(req, staff, 'verified-token')
    expect(result?.accountCompletion).toMatchObject({
      source: 'legacy-password-login',
      subject,
      clinicId: '8',
      evidenceAt: '2026-10-03T10:00:00.000Z',
    })
    expect(result?.accountCompletion?.evidenceAt).not.toBe(snapshotAt)
  })

  it.each(['magiclink', 'otp', 'email/signup', 'oauth'])(
    'rejects generic %s sessions as password proof',
    async (method) => {
      const req = request()
      provider.getClaims.mockResolvedValueOnce({
        data: { claims: { sub: subject, amr: [{ method, timestamp: Date.now() / 1000 }] } },
        error: null,
      })
      expect(await establishLegacyClinicPasswordEvidence(req, staff, 'verified-token')).toBeNull()
      expect(req.payload.update).not.toHaveBeenCalled()
    },
  )

  it.each([
    { legacyAccess: undefined },
    { legacyAccess: { ...staff.legacyAccess, initialParticipant: false } },
    { legacyAccess: { ...staff.legacyAccess, subject: 'other' } },
    { status: 'disabled' },
    { authSync: { status: 'failed' } },
    { clinic: 9 },
  ])('rejects ineligible legacy state %j before recording evidence', async (change) => {
    const req = request()
    expect(
      await establishLegacyClinicPasswordEvidence(req, { ...staff, ...change } as ClinicStaff, 'verified-token'),
    ).toBeNull()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('rejects mismatched verified subjects and stale password sessions', async () => {
    const req = request()
    provider.getClaims.mockResolvedValueOnce({
      data: { claims: { sub: 'other', amr: [{ method: 'password', timestamp: Date.now() / 1000 }] } },
      error: null,
    })
    expect(await establishLegacyClinicPasswordEvidence(req, staff, 'verified-token')).toBeNull()
    provider.getClaims.mockResolvedValueOnce({
      data: { claims: { sub: subject, amr: [{ method: 'password', timestamp: Date.now() / 1000 - 3600 }] } },
      error: null,
    })
    expect(await establishLegacyClinicPasswordEvidence(req, staff, 'verified-token')).toBeNull()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('rejects editable Admin input and arbitrary Local API flags', async () => {
    const req = request()
    req.context = { overrideAccess: true, passwordCompleted: true, clinicAccountEvidenceCapability: {} }
    expect(() =>
      guardClinicAccountEvidence({
        req,
        originalDoc: staff,
        data: { accountCompletion: { source: 'initial-password', subject } },
        operation: 'update',
      } as never),
    ).toThrow()
  })

  it('requires a completed identity-bound invitation for new principals', async () => {
    const req = request()
    provider.readAction.mockResolvedValue({
      id: 1,
      actionType: 'clinic-invitation',
      state: 'confirmed',
      principal: { relationTo: 'clinicStaff', value: 22 },
      supabaseSubject: subject,
    })
    await expect(
      recordClinicInitialPasswordCompletion(req, { authActionId: 1, token: 'verified-token' }, 'test'),
    ).rejects.toThrow()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('retains successful new completion evidence without a mutable AuthAction relationship', async () => {
    const req = request()
    provider.readAction.mockResolvedValue({
      id: 1,
      actionType: 'clinic-invitation',
      state: 'completed',
      principal: { relationTo: 'clinicStaff', value: 22 },
      supabaseSubject: subject,
      createdAt: '2026-10-03T09:00:00.000Z',
    })
    const result = await recordClinicInitialPasswordCompletion(
      req,
      { authActionId: 1, token: 'verified-token' },
      'test',
    )
    expect(result.accountCompletion).toMatchObject({ source: 'initial-password', authActionId: '1', subject })
  })

  it('rejects unsigned historical assertions and mismatched deployment signatures', async () => {
    const req = request()
    const options = {
      environment: 'test' as const,
      authVersion: 'audited-version',
      verificationKey: Buffer.alloc(32, 7),
    }
    await expect(
      importLegacyClinicPasswordEvidence(req, { manifest: '{}', signature: '0'.repeat(64) }, options),
    ).rejects.toThrow()
    const manifest = JSON.stringify({
      version: 1,
      environment: 'production',
      authVersion: 'audited-version',
      clinicStaffId: 22,
      clinicId: 8,
      subject,
      actorSubject: subject,
      eventId: '00000000-0000-4000-8000-000000000001',
      event: 'user_updated_password',
      context: 'authenticated-user',
      identityCreatedAt: '2026-10-01T00:00:00.000Z',
      eventAt: '2026-10-02T00:00:00.000Z',
      reviewedAt: '2026-10-03T08:00:00.000Z',
    })
    const signature = createHmac('sha256', options.verificationKey).update(manifest).digest('hex')
    await expect(importLegacyClinicPasswordEvidence(req, { manifest, signature }, options)).rejects.toThrow()
    expect(req.payload.update).not.toHaveBeenCalled()
  })
})
