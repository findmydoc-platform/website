import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { createInitialClinicSupabaseAccount } from '@/auth/utilities/supabaseProvision'
import { ensureBaseline } from '../../fixtures/ensureBaseline'
import { cleanupTrackedUsers, createPlatformTestUser } from '../../fixtures/testUsers'

describe('MCP clinic onboarding', () => {
  let payload: Payload
  let specialtyId: number
  let ownerId: number
  let token: string
  const staffIds: number[] = []
  const keyIds: number[] = []
  const name = `MCP onboarding ${randomUUID()}`

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    ownerId = (await createPlatformTestUser(payload, { emailPrefix: 'mcp-onboarding', createdStaffIds: staffIds })).id
    specialtyId = (
      await payload.find({
        collection: 'medical-specialties',
        where: { parentSpecialty: { exists: false } },
        limit: 1,
      })
    ).docs[0]!.id
    token = await createKey({ create: true, read: true, correct: true })
  })

  afterAll(async () => {
    if (!payload) return
    for (const id of keyIds) await payload.delete({ collection: 'payload-mcp-api-keys', id, overrideAccess: true })
    await cleanupTrackedUsers(payload, { staffIds })
  })

  async function createKey(
    clinicOnboarding: { create?: boolean; read?: boolean; correct?: boolean; decide?: boolean },
    user = ownerId,
  ) {
    const apiKey = randomUUID()
    const key = await payload.create({
      collection: 'payload-mcp-api-keys',
      data: { user, enableAPIKey: true, apiKey, label: name, clinicOnboarding },
      overrideAccess: true,
    })
    keyIds.push(key.id)
    return apiKey
  }

  async function call(
    name: string,
    args: Record<string, unknown>,
    bearer = token,
  ): Promise<{ data: unknown; error: unknown }> {
    const endpoint = payload.config.endpoints.find((entry) => entry.path === '/mcp' && entry.method === 'post')
    if (!endpoint) throw new Error('Expected the MCP POST endpoint')
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    })
    const req = await createLocalReq(
      { req: { method: request.method, url: request.url, headers: request.headers, body: request.body } },
      payload,
    )
    const response = await endpoint.handler(req)
    expect(response.status).toBe(200)
    const text = await response.text()
    const dataLine = text.split('\n').find((line) => line.startsWith('data:'))
    const { result, error } = JSON.parse(dataLine ? dataLine.slice(5).trim() : text)
    const content = result?.content?.[0]?.text
    if (error || result?.isError) return { data: undefined, error: error?.message ?? content }
    return { data: JSON.parse(content), error: undefined }
  }

  function intake() {
    return {
      requestKey: randomUUID(),
      staffMode: 'new_account',
      clinicName: `${name} ${randomUUID()}`,
      clinicWebsite: 'https://clinic.example.com',
      medicalSpecialtyIds: [specialtyId],
      contactFirstName: 'Ada',
      contactLastName: 'Test',
      contactEmail: `${randomUUID()}@example.com`,
      contactRole: 'Clinic Management',
    }
  }

  function stagedIds(data: unknown) {
    expect(data).toMatchObject({
      applicationId: expect.any(Number),
      clinicId: expect.any(Number),
      clinicStaffId: expect.any(Number),
    })
    const ids = data as { applicationId: number; clinicId: number; clinicStaffId: number }
    return ids
  }

  it('stages one private clinic and pending account and replays the same IDs', async () => {
    vi.mocked(createInitialClinicSupabaseAccount).mockClear()
    const input = intake()
    const first = await call('stageClinicOnboarding', input)
    expect(first.error).toBeUndefined()
    const ids = stagedIds(first.data)
    expect(first.data).toMatchObject({
      staffMode: 'new_account',
      decisionStatus: 'submitted',
      participationStatus: 'pending',
      accountSetupStatus: 'not_started',
      publicStatus: 'pending',
    })
    expect(await call('stageClinicOnboarding', input)).toEqual(first)
    expect(
      await payload.findByID({ collection: 'clinicStaff', id: ids.clinicStaffId, depth: 0, overrideAccess: true }),
    ).toMatchObject({ clinic: ids.clinicId, assignmentScope: 'local', email: input.contactEmail, status: 'pending' })
    const foundPublic = await payload.find({
      collection: 'clinics',
      where: { id: { equals: ids.clinicId } },
      overrideAccess: false,
    })
    expect(foundPublic.docs).toEqual([])
    expect(vi.mocked(createInitialClinicSupabaseAccount)).not.toHaveBeenCalled()
  })
  it('returns one set of records for simultaneous calls with the same request key', async () => {
    const input = intake()
    const [first, second] = await Promise.all([
      call('stageClinicOnboarding', input),
      call('stageClinicOnboarding', input),
    ])
    stagedIds(first.data)
    expect(second).toEqual(first)
  })

  it('rejects native approval of a staged application and initial account', async () => {
    const { applicationId, clinicStaffId } = stagedIds((await call('stageClinicOnboarding', intake())).data)
    await expect(
      payload.update({
        collection: 'clinicApplications',
        id: applicationId,
        data: { status: 'approved' },
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: clinicStaffId,
        data: { status: 'approved' },
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({
      decisionStatus: 'submitted',
      accountSetupStatus: 'not_started',
    })
  })

  it('requires separate grants and the key owner’s current clinic creation access', async () => {
    const input = intake()
    const readOnly = await createKey({ read: true })
    expect((await call('stageClinicOnboarding', input, readOnly)).error).toBeDefined()

    const editor = await createPlatformTestUser(payload, {
      emailPrefix: 'mcp-onboarding-editor',
      createdStaffIds: staffIds,
    })
    await payload.update({
      collection: 'platformStaff',
      id: editor.id,
      data: { role: 'content-manager' },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    })
    const editorKey = await createKey({ create: true }, editor.id)
    expect((await call('stageClinicOnboarding', input, editorKey)).error).toBeDefined()
    const created = await call('stageClinicOnboarding', input)
    const { applicationId } = stagedIds(created.data)
    expect((await call('readClinicOnboarding', { applicationId }, readOnly)).data).toMatchObject({
      applicationId,
      clinicName: input.clinicName,
      contactEmail: input.contactEmail,
    })
    expect(
      (await call('correctClinicOnboarding', { applicationId, contactEmail: 'denied@example.com' }, readOnly)).error,
    ).toBeDefined()
    const legacyKey = await createKey({})
    expect((await call('readClinicOnboarding', { applicationId }, legacyKey)).error).toBeDefined()
  })

  it('requires the decision grant and rejects an open application without preparing an account', async () => {
    vi.mocked(createInitialClinicSupabaseAccount).mockClear()
    const { applicationId, clinicId, clinicStaffId } = stagedIds((await call('stageClinicOnboarding', intake())).data)
    const reason = 'The clinic withdrew its request.'
    const decisionKey = await createKey({ decide: true })
    expect((await call('approveClinicOnboarding', { applicationId })).error).toBeDefined()
    expect((await call('rejectClinicOnboarding', { applicationId, reason })).error).toBeDefined()
    expect((await call('rejectClinicOnboarding', { applicationId, reason: ' ' }, decisionKey)).error).toBeDefined()
    expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({
      decisionStatus: 'submitted',
      participationStatus: 'pending',
    })

    expect(await call('rejectClinicOnboarding', { applicationId, reason }, decisionKey)).toMatchObject({
      data: {
        applicationId,
        clinicId,
        clinicStaffId,
        decisionStatus: 'rejected',
        participationStatus: 'rejected',
        accountSetupStatus: 'not_started',
        publicStatus: 'pending',
      },
    })
    expect((await call('approveClinicOnboarding', { applicationId }, decisionKey)).error).toBeDefined()
    expect(await payload.findByID({ collection: 'clinicApplications', id: applicationId, depth: 0 })).toMatchObject({
      reviewNotes: reason,
    })
    const clinicStaff = await payload.findByID({ collection: 'clinicStaff', id: clinicStaffId, depth: 0 })
    expect(clinicStaff.status).toBe('pending')
    expect(clinicStaff.supabaseUserId).toBeFalsy()
    expect(clinicStaff.invitationAuthorizedAt).toBeFalsy()
    expect(vi.mocked(createInitialClinicSupabaseAccount)).not.toHaveBeenCalled()
  })

  it('keeps an approval after provider failure and retries the same account and invitation', async () => {
    const input = intake()
    const { applicationId, clinicId, clinicStaffId } = stagedIds((await call('stageClinicOnboarding', input)).data)
    const decisionKey = await createKey({ decide: true })
    const subject = randomUUID()
    const provision = vi.mocked(createInitialClinicSupabaseAccount)
    provision.mockClear()
    provision.mockRejectedValueOnce(new Error('provider failure fixture')).mockImplementationOnce(async () => {
      expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({
        decisionStatus: 'approved',
        participationStatus: 'approved',
      })
      return subject
    })

    expect(await call('approveClinicOnboarding', { applicationId }, decisionKey)).toMatchObject({
      data: {
        applicationId,
        clinicId,
        clinicStaffId,
        decisionStatus: 'approved',
        participationStatus: 'approved',
        accountSetupStatus: 'failed',
        accountSetupErrorCode: 'auth_failed',
        invitationStatus: 'not_started',
        publicStatus: 'pending',
      },
    })
    expect(
      (await call('rejectClinicOnboarding', { applicationId, reason: 'Already approved.' }, decisionKey)).error,
    ).toBeDefined()

    expect(await call('approveClinicOnboarding', { applicationId }, decisionKey)).toMatchObject({
      data: { applicationId, clinicId, clinicStaffId, decisionStatus: 'approved', accountSetupStatus: 'completed' },
    })
    expect(
      await payload.findByID({ collection: 'clinicStaff', id: clinicStaffId, depth: 0, overrideAccess: true }),
    ).toMatchObject({ clinic: clinicId, status: 'approved', supabaseUserId: subject, authSync: { status: 'synced' } })
    expect(await readClinicAccessState(payload, clinicStaffId)).toBeNull()
    expect(
      (await payload.find({ collection: 'clinics', where: { id: { equals: clinicId } }, overrideAccess: false })).docs,
    ).toEqual([])

    const actions = bindAuthActions(await createLocalReq({}, payload), { environment: 'test' })
    const invitation = await actions.reserveClinicInvitation({ clinicStaffId })
    expect(invitation).toMatchObject({
      actionType: 'clinic-invitation',
      supabaseSubject: subject,
      principal: { relationTo: 'clinicStaff', value: clinicStaffId },
    })
    expect(await call('approveClinicOnboarding', { applicationId }, decisionKey)).toMatchObject({
      data: { applicationId, clinicId, clinicStaffId, decisionStatus: 'approved', accountSetupStatus: 'completed' },
    })
    expect((await actions.reserveClinicInvitation({ clinicStaffId }))?.id).toBe(invitation?.id)
    expect(provision).toHaveBeenCalledTimes(2)
    expect(provision).toHaveBeenCalledWith(
      expect.objectContaining({ email: input.contactEmail, onboardingKey: `clinic-application:${applicationId}` }),
      expect.anything(),
    )
  })

  it('allows just one decision when approval and rejection race', async () => {
    const { applicationId } = stagedIds((await call('stageClinicOnboarding', intake())).data)
    const decisionKey = await createKey({ decide: true })
    const [approved, rejected] = await Promise.all([
      call('approveClinicOnboarding', { applicationId }, decisionKey),
      call('rejectClinicOnboarding', { applicationId, reason: 'The request was withdrawn.' }, decisionKey),
    ])
    expect([approved, rejected].filter(({ error }) => error !== undefined)).toHaveLength(1)
    const decided = (await call('readClinicOnboarding', { applicationId })).data
    expect(decided).toMatchObject({
      decisionStatus: approved.error === undefined ? 'approved' : 'rejected',
      publicStatus: 'pending',
    })
  })

  it('corrects the first contact and account together in an open application', async () => {
    const input = intake()
    const { applicationId, clinicId, clinicStaffId } = stagedIds((await call('stageClinicOnboarding', input)).data)
    const contactEmail = `${randomUUID()}@example.com`
    expect(
      await call('correctClinicOnboarding', { applicationId, contactEmail: contactEmail.toUpperCase() }),
    ).toMatchObject({ data: { applicationId, clinicId, clinicStaffId, decisionStatus: 'submitted' } })
    expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({ applicationId, contactEmail })
    const [clinic, staff] = await Promise.all([
      payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true }),
      payload.findByID({ collection: 'clinicStaff', id: clinicStaffId, depth: 0, overrideAccess: true }),
    ])
    expect(clinic.internalPrimaryContact?.email).toBe(contactEmail)
    expect(staff.email).toBe(contactEmail)
    expect((await call('stageClinicOnboarding', input)).data).toMatchObject({ applicationId, clinicId, clinicStaffId })
  })

  it('rolls back clinic and application when a staff email already belongs to another account', async () => {
    const input = { ...intake(), contactEmail: `${randomUUID()}@example.com` }
    const staff = await payload.create({
      collection: 'clinicStaff',
      data: { email: input.contactEmail, status: 'pending' },
      overrideAccess: true,
    })
    try {
      expect((await call('stageClinicOnboarding', input)).error).toBeDefined()
      const [applications, clinics] = await Promise.all([
        payload.find({
          collection: 'clinicApplications',
          where: { clinicName: { equals: input.clinicName } },
          overrideAccess: true,
        }),
        payload.find({ collection: 'clinics', where: { name: { equals: input.clinicName } }, overrideAccess: true }),
      ])
      expect(applications.docs).toEqual([])
      expect(clinics.docs).toEqual([])
      expect(
        (await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true })).clinic,
      ).toBeNull()
    } finally {
      await payload.delete({ collection: 'clinicStaff', id: staff.id, overrideAccess: true })
    }
  })

  it('rejects incomplete input and keeps matching submissions from leaking record IDs', async () => {
    const input = intake()
    expect((await call('stageClinicOnboarding', { ...input, contactLastName: undefined })).error).toBeDefined()
    expect((await call('stageClinicOnboarding', { ...input, medicalSpecialtyIds: [] })).error).toBeDefined()
    expect(
      (
        await payload.find({
          collection: 'clinicApplications',
          where: { clinicName: { equals: input.clinicName } },
          overrideAccess: true,
        })
      ).docs,
    ).toEqual([])
    const { applicationId } = stagedIds((await call('stageClinicOnboarding', input)).data)
    const duplicate = await call('stageClinicOnboarding', { ...input, requestKey: randomUUID() })
    expect(duplicate.data).toBeUndefined()
    expect(duplicate.error).toBeDefined()
    expect(String(duplicate.error)).not.toContain(String(applicationId))
  })
})
