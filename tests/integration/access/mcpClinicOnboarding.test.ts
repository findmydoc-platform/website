import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import {
  createInitialClinicSupabaseAccount,
  reconcileExistingClinicSupabaseAccount,
  setClinicSupabaseAccountAccess,
} from '@/auth/utilities/supabaseProvision'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPlatformTestUser,
  replaceClinicTestUserAssignment,
} from '../../fixtures/testUsers'

describe('MCP clinic onboarding', () => {
  let payload: Payload
  let specialtyId: number
  let previousClinicId: number
  let ownerId: number
  let token: string
  const staffIds: Array<number | string> = []
  const keyIds: number[] = []
  const name = `MCP onboarding ${randomUUID()}`

  beforeAll(async () => {
    payload = await getPayload({ config })
    ownerId = (await createPlatformTestUser(payload, { emailPrefix: 'mcp-onboarding', createdStaffIds: staffIds })).id
    specialtyId = (
      await payload.create({
        collection: 'medical-specialties',
        data: { name: `${name} specialty`, iconKey: 'fallback' },
        overrideAccess: true,
      })
    ).id
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
      applicationRevision: expect.stringMatching(/^[a-f0-9]{64}$/u),
    })
    const ids = data as { applicationId: number; clinicId: number; clinicStaffId: number; applicationRevision: string }
    return ids
  }

  async function readRevision(applicationId: number) {
    return stagedIds((await call('readClinicOnboarding', { applicationId })).data).applicationRevision
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
  async function createActivatedStaff() {
    if (!previousClinicId) {
      const country = await payload.create({
        collection: 'countries',
        data: { name: 'Fixture country', isoCode: 'DE', language: 'German', currency: 'EUR' },
        overrideAccess: true,
      })
      const city = await payload.create({
        collection: 'cities',
        data: { name: 'Fixture city', country: country.id, coordinates: [13.4, 52.5] },
        overrideAccess: true,
      })
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Previous clinic',
          slug: `previous-clinic-${randomUUID()}`,
          status: 'approved',
          address: { country: country.id, city: city.id, street: 'Fixture street', houseNumber: '1', zipCode: '10115' },
          supportedLanguages: ['german'],
          internalPrimaryContact: {
            firstName: 'Fixture',
            lastName: 'Contact',
            email: 'fixture@example.com',
            role: 'Clinic Management',
          },
        },
        overrideAccess: true,
      })
      previousClinicId = clinic.id
    }
    const staff = await createClinicTestUser(payload, { emailPrefix: randomUUID(), createdStaffIds: staffIds })
    await asClinicScopedPayloadUser(payload, staff, previousClinicId)
    await replaceClinicTestUserAssignment(payload, staff.id, null)
    const activated = await payload.findByID({
      collection: 'clinicStaff',
      id: staff.id,
      depth: 0,
      overrideAccess: true,
    })
    if (!activated.email) throw new Error('Expected the activated fixture to have an email.')
    return { ...activated, email: activated.email }
  }

  function existingIntake(clinicStaffId: number) {
    const { contactFirstName: _first, contactLastName: _last, contactEmail: _email, ...input } = intake()
    return { ...input, staffMode: 'existing_account', clinicStaffId }
  }

  it('finds a readable activated unassigned account and stages only its selection', async () => {
    const staff = await createActivatedStaff()
    const lookup = { email: ` ${staff.email.toUpperCase()} ` }
    const createOnly = await createKey({ create: true })
    expect((await call('findEligibleClinicOnboardingStaff', lookup, createOnly)).error).toBeDefined()
    expect(await call('findEligibleClinicOnboardingStaff', lookup)).toEqual({
      data: {
        candidate: {
          clinicStaffId: staff.id,
          email: staff.email,
          firstName: staff.firstName,
          lastName: staff.lastName,
        },
      },
      error: undefined,
    })
    expect(
      (
        await call('stageClinicOnboarding', {
          ...existingIntake(staff.id),
          clinicStaffId: undefined,
          contactEmail: staff.email,
        })
      ).error,
    ).toBeDefined()
    const input = existingIntake(staff.id)
    const staged = await call('stageClinicOnboarding', input)
    expect(staged.data).toMatchObject({
      staffMode: 'existing_account',
      clinicStaffId: staff.id,
      decisionStatus: 'submitted',
      participationStatus: 'pending',
      accountSetupStatus: 'not_started',
      publicStatus: 'pending',
    })
    const { applicationId } = stagedIds(staged.data)
    expect(await call('stageClinicOnboarding', input)).toEqual(staged)
    expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({
      contactEmail: staff.email,
      contactFirstName: staff.firstName,
      contactLastName: staff.lastName,
    })
    expect(await payload.findByID({ collection: 'clinicStaff', id: staff.id, depth: 0, overrideAccess: true })).toEqual(
      staff,
    )
  })

  it('corrects the selected account and approves the original activated identity without an invitation', async () => {
    const original = await createActivatedStaff()
    const selected = await createActivatedStaff()
    const decisionKey = await createKey({ decide: true })
    const providerCalls = [
      vi.mocked(createInitialClinicSupabaseAccount),
      vi.mocked(reconcileExistingClinicSupabaseAccount),
      vi.mocked(setClinicSupabaseAccountAccess),
    ]
    providerCalls.forEach((mock) => mock.mockClear())
    const { applicationId, clinicId, applicationRevision } = stagedIds(
      (await call('stageClinicOnboarding', existingIntake(original.id))).data,
    )
    expect((await call('correctClinicOnboarding', { applicationId, contactEmail: selected.email })).error).toBeDefined()
    expect(
      await call('correctClinicOnboarding', { applicationId, clinicStaffId: selected.id, contactFirstName: 'Contact' }),
    ).toMatchObject({ data: { applicationId, clinicId, clinicStaffId: selected.id, decisionStatus: 'submitted' } })
    expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({
      contactEmail: selected.email,
      contactFirstName: 'Contact',
    })
    expect(
      await payload.findByID({ collection: 'clinicStaff', id: selected.id, depth: 0, overrideAccess: true }),
    ).toEqual(selected)
    const currentRevision = await readRevision(applicationId)
    expect(currentRevision).not.toBe(applicationRevision)
    expect((await call('approveClinicOnboarding', { applicationId }, decisionKey)).error).toBeDefined()
    expect(
      (await call('approveClinicOnboarding', { applicationId, applicationRevision }, decisionKey)).error,
    ).toBeDefined()
    expect(
      (
        await call(
          'rejectClinicOnboarding',
          { applicationId, applicationRevision, reason: 'Stale review.' },
          decisionKey,
        )
      ).error,
    ).toBeDefined()
    expect(await readClinicAccessState(payload, original.id)).toBeNull()
    expect(await readClinicAccessState(payload, selected.id)).toBeNull()
    expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({
      decisionStatus: 'submitted',
      participationStatus: 'pending',
      clinicStaffId: selected.id,
    })
    const approval = await call(
      'approveClinicOnboarding',
      { applicationId, applicationRevision: currentRevision },
      decisionKey,
    )
    expect(approval).toMatchObject({
      data: {
        clinicId,
        clinicStaffId: selected.id,
        decisionStatus: 'approved',
        accountSetupStatus: 'completed',
        participationStatus: 'approved',
        publicStatus: 'pending',
        invitationStatus: 'not_started',
      },
    })
    expect(
      await call(
        'approveClinicOnboarding',
        { applicationId, applicationRevision: await readRevision(applicationId) },
        decisionKey,
      ),
    ).toEqual(approval)
    expect(await readClinicAccessState(payload, selected.id)).toMatchObject({ clinic: { id: clinicId } })
    expect(
      await payload.findByID({ collection: 'clinicStaff', id: selected.id, depth: 0, overrideAccess: true }),
    ).toMatchObject({
      id: selected.id,
      firstName: selected.firstName,
      lastName: selected.lastName,
      email: selected.email,
      clinic: clinicId,
      group: null,
      assignmentScope: 'local',
      supabaseUserId: selected.supabaseUserId,
      activationReadiness: selected.activationReadiness,
      accountCompletion: selected.accountCompletion,
      authSync: selected.authSync,
      status: selected.status,
      onboardingKey: selected.onboardingKey,
      invitationAuthorizedAt: selected.invitationAuthorizedAt,
    })
    expect(
      await payload.findByID({ collection: 'clinicStaff', id: original.id, depth: 0, overrideAccess: true }),
    ).toEqual(original)
    providerCalls.forEach((mock) => expect(mock).not.toHaveBeenCalled())
  })

  it('keeps the reviewed assignment consistent when correction and approval race', async () => {
    const original = await createActivatedStaff()
    const replacement = await createActivatedStaff()
    const { applicationId, clinicId, applicationRevision } = stagedIds(
      (await call('stageClinicOnboarding', existingIntake(original.id))).data,
    )
    const decisionKey = await createKey({ decide: true })
    const [approval, correction] = await Promise.all([
      call('approveClinicOnboarding', { applicationId, applicationRevision }, decisionKey),
      call('correctClinicOnboarding', { applicationId, clinicStaffId: replacement.id }),
    ])
    expect([approval, correction].filter(({ error }) => error !== undefined)).toHaveLength(1)
    const result = (await call('readClinicOnboarding', { applicationId })).data
    expect(await readClinicAccessState(payload, replacement.id)).toBeNull()
    if (approval.error === undefined) {
      expect(result).toMatchObject({ clinicStaffId: original.id, decisionStatus: 'approved' })
      expect(await readClinicAccessState(payload, original.id)).toMatchObject({ clinic: { id: clinicId } })
    } else {
      expect(result).toMatchObject({ clinicStaffId: replacement.id, decisionStatus: 'submitted' })
      expect(await readClinicAccessState(payload, original.id)).toBeNull()
    }
  })

  it('preserves an intervening group assignment and leaves the application open until rejection', async () => {
    const staff = await createActivatedStaff()
    const input = existingIntake(staff.id)
    const { applicationId, applicationRevision } = stagedIds((await call('stageClinicOnboarding', input)).data)
    const owner = await payload.findByID({ collection: 'platformStaff', id: ownerId, overrideAccess: true })
    const req = await createLocalReq({ user: asPayloadStaffUser(owner) }, payload)
    const group = await payload.create({
      collection: 'clinicGroups',
      data: { name: `MCP group ${randomUUID()}` },
      overrideAccess: false,
      req,
    })
    await replaceClinicStaffAssignment(req, staff.id, { scope: 'group', groupId: group.id })
    const grouped = await payload.findByID({ collection: 'clinicStaff', id: staff.id, depth: 0, overrideAccess: true })
    expect(await call('findEligibleClinicOnboardingStaff', { email: staff.email })).toMatchObject({
      data: { candidate: null },
    })
    expect((await call('stageClinicOnboarding', { ...input, requestKey: randomUUID() })).error).toBeDefined()
    expect((await call('correctClinicOnboarding', { applicationId, clinicStaffId: staff.id })).error).toBeDefined()
    const decisionKey = await createKey({ decide: true })
    expect(
      (await call('approveClinicOnboarding', { applicationId, applicationRevision }, decisionKey)).error,
    ).toBeDefined()
    expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({
      decisionStatus: 'submitted',
      accountSetupStatus: 'not_started',
      participationStatus: 'pending',
    })
    expect(
      await call(
        'rejectClinicOnboarding',
        { applicationId, applicationRevision, reason: 'No longer available.' },
        decisionKey,
      ),
    ).toMatchObject({
      data: { decisionStatus: 'rejected', participationStatus: 'rejected', invitationStatus: 'not_started' },
    })
    expect(await payload.findByID({ collection: 'clinicStaff', id: staff.id, depth: 0, overrideAccess: true })).toEqual(
      grouped,
    )
  })

  it('assigns an activated account to just one application when approval requests race', async () => {
    const staff = await createActivatedStaff()
    const first = stagedIds((await call('stageClinicOnboarding', existingIntake(staff.id))).data)
    const second = stagedIds((await call('stageClinicOnboarding', existingIntake(staff.id))).data)
    const decisionKey = await createKey({ decide: true })
    const [firstDecision, secondDecision] = await Promise.all([
      call(
        'approveClinicOnboarding',
        { applicationId: first.applicationId, applicationRevision: first.applicationRevision },
        decisionKey,
      ),
      call(
        'approveClinicOnboarding',
        { applicationId: second.applicationId, applicationRevision: second.applicationRevision },
        decisionKey,
      ),
    ])
    expect([firstDecision, secondDecision].filter(({ error }) => error !== undefined)).toHaveLength(1)
    const [winner, open] = firstDecision.error === undefined ? [first, second] : [second, first]
    expect(await readClinicAccessState(payload, staff.id)).toMatchObject({ clinic: { id: winner.clinicId } })
    expect((await call('readClinicOnboarding', { applicationId: open.applicationId })).data).toMatchObject({
      decisionStatus: 'submitted',
      participationStatus: 'pending',
    })
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
    const { applicationId, clinicId, clinicStaffId, applicationRevision } = stagedIds(
      (await call('stageClinicOnboarding', intake())).data,
    )
    const reason = 'The clinic withdrew its request.'
    const decisionKey = await createKey({ decide: true })
    expect((await call('approveClinicOnboarding', { applicationId, applicationRevision })).error).toBeDefined()
    expect((await call('rejectClinicOnboarding', { applicationId, applicationRevision, reason })).error).toBeDefined()
    expect(
      (await call('rejectClinicOnboarding', { applicationId, applicationRevision, reason: ' ' }, decisionKey)).error,
    ).toBeDefined()
    expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({
      decisionStatus: 'submitted',
      participationStatus: 'pending',
    })

    expect(
      await call('rejectClinicOnboarding', { applicationId, applicationRevision, reason }, decisionKey),
    ).toMatchObject({
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
    expect(
      (await call('approveClinicOnboarding', { applicationId, applicationRevision }, decisionKey)).error,
    ).toBeDefined()
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
    const { applicationId, clinicId, clinicStaffId, applicationRevision } = stagedIds(
      (await call('stageClinicOnboarding', input)).data,
    )
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

    expect(await call('approveClinicOnboarding', { applicationId, applicationRevision }, decisionKey)).toMatchObject({
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
      (
        await call(
          'rejectClinicOnboarding',
          { applicationId, applicationRevision: await readRevision(applicationId), reason: 'Already approved.' },
          decisionKey,
        )
      ).error,
    ).toBeDefined()

    expect(
      (await call('approveClinicOnboarding', { applicationId, applicationRevision }, decisionKey)).error,
    ).toBeDefined()
    expect(
      await call(
        'approveClinicOnboarding',
        { applicationId, applicationRevision: await readRevision(applicationId) },
        decisionKey,
      ),
    ).toMatchObject({
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
    expect(
      await call(
        'approveClinicOnboarding',
        { applicationId, applicationRevision: await readRevision(applicationId) },
        decisionKey,
      ),
    ).toMatchObject({
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
    const { applicationId, applicationRevision } = stagedIds((await call('stageClinicOnboarding', intake())).data)
    const decisionKey = await createKey({ decide: true })
    const [approved, rejected] = await Promise.all([
      call('approveClinicOnboarding', { applicationId, applicationRevision }, decisionKey),
      call(
        'rejectClinicOnboarding',
        { applicationId, applicationRevision, reason: 'The request was withdrawn.' },
        decisionKey,
      ),
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

  it('leaves no staged records when the email already belongs to another staff account', async () => {
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

  it('preserves the first contact when a correction uses another staff account email', async () => {
    const input = intake()
    const { applicationId, clinicId, clinicStaffId } = stagedIds((await call('stageClinicOnboarding', input)).data)
    const otherEmail = `${randomUUID()}@example.com`
    const otherStaff = await payload.create({
      collection: 'clinicStaff',
      data: { email: otherEmail, status: 'pending' },
      overrideAccess: true,
    })
    try {
      const correction = await call('correctClinicOnboarding', {
        applicationId,
        contactEmail: otherEmail.toUpperCase(),
      })
      expect(correction.error).toBeDefined()
      expect((await call('readClinicOnboarding', { applicationId })).data).toMatchObject({
        contactEmail: input.contactEmail,
      })
      const [clinic, staff] = await Promise.all([
        payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true }),
        payload.findByID({ collection: 'clinicStaff', id: clinicStaffId, depth: 0, overrideAccess: true }),
      ])
      expect(clinic.internalPrimaryContact?.email).toBe(input.contactEmail)
      expect(staff.email).toBe(input.contactEmail)
    } finally {
      await payload.delete({ collection: 'clinicStaff', id: otherStaff.id, overrideAccess: true })
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
