import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import {
  readClinicOpenInquiryInventory,
  readClinicInquiryDetail,
  updateClinicInquiryReadPosition,
  updateClinicInquiryState,
} from '@/features/inquiryCommunication/service'
import { changeClinicGroup } from '@/features/clinicGroups/membership'
import { inquiryPackageTombstoneKey } from '@/features/inquiryAggregate/tombstones'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  createPlatformTestUser,
  cleanupTrackedUsers,
  createClinicTestUser,
} from '../fixtures/testUsers'

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (config: unknown) => config }))

describe('authorized open inquiry inventory', () => {
  let payload: Payload
  let clinicId: number
  let foreignClinicId: number
  let clinicReqA: PayloadRequest
  let clinicReqB: PayloadRequest
  let foreignClinicReq: PayloadRequest
  let operator: PayloadRequest
  const createdInquiryIds: string[] = []
  const createdStaffIds: (number | string)[] = []
  const doctorIds: number[] = []
  const slugPrefix = testSlug('inquiryOpenInventory.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]!
    const local = await createClinicFixture(payload, city.id, { slugPrefix })
    const foreign = await createClinicFixture(payload, city.id, {
      slugPrefix: `${slugPrefix}-foreign`,
      clinicIndex: 1,
      doctorIndex: 1,
    })
    clinicId = local.clinic.id
    foreignClinicId = foreign.clinic.id
    doctorIds.push(local.doctor.id, foreign.doctor.id)
    await payload.update({
      collection: 'clinics',
      id: foreignClinicId,
      data: { status: 'approved' },
      overrideAccess: true,
    })
    operator = await createLocalReq(
      {
        user: asPayloadStaffUser(
          await createPlatformTestUser(payload, { createdStaffIds, emailPrefix: `${slugPrefix}-operator` }),
        ),
      },
      payload,
    )
    const makeRequest = async (suffix: string, target: number) => {
      const staff = await createClinicTestUser(payload, { createdStaffIds, emailPrefix: `${slugPrefix}-${suffix}` })
      const req = await createLocalReq({}, payload)
      req.user = await asClinicScopedPayloadUser(payload, staff, target)
      return req
    }
    clinicReqA = await makeRequest('local-a', clinicId)
    clinicReqB = await makeRequest('local-b', clinicId)
    foreignClinicReq = await makeRequest('foreign-staff', foreignClinicId)
  }, 60_000)

  afterAll(async () => {
    await payload.delete({
      collection: 'inquiryDeletionProofs',
      overrideAccess: true,
      where: { inquiryId: { in: createdInquiryIds } },
    })
    for (const collection of ['inquiryAuditEvents', 'inquiryConversations'] as const) {
      await payload.delete({ collection, overrideAccess: true, where: { inquiry: { in: createdInquiryIds } } })
    }
    await payload.delete({
      collection: 'inquiryReadPositions',
      overrideAccess: true,
      where: { inquiry: { in: createdInquiryIds } },
    })
    await payload.delete({
      collection: 'patientClinicInquiries',
      overrideAccess: true,
      where: { id: { in: createdInquiryIds } },
    })
    await cleanupTrackedUsers(payload, { staffIds: createdStaffIds })
    for (const id of doctorIds) await payload.delete({ collection: 'doctors', id, overrideAccess: true })
    for (const id of [clinicId, foreignClinicId])
      await payload.delete({ collection: 'clinics', id, overrideAccess: true })
  })

  it('counts the complete open workload across pages independently of personal read positions', async () => {
    const before = await readClinicOpenInquiryInventory(clinicReqA)
    const inquiries = []
    for (let index = 0; index < 144; index += 1) {
      const handlingStatus = (['submitted', 'in_review', 'contacted', 'spam'] as const)[index % 4]!
      const inquiry = await payload.create({
        collection: 'patientClinicInquiries',
        context: { inquiryCommunicationCommand: true },
        data: {
          clinic: clinicId,
          createdAt: '2020-01-01T00:00:00.000Z',
          fullName: 'Synthetic inventory patient',
          email: 'inventory@example.invalid',
          phoneNumber: '+493000000001',
          message: 'Synthetic inventory inquiry.',
          consent: { accepted: true, acceptedAt: '2020-01-01T00:00:00.000Z', text: 'Synthetic consent.' },
          status: handlingStatus === 'spam' ? 'spam' : handlingStatus,
          handlingStatus,
          lifecycle: index < 140 ? 'open' : 'closed',
          revision: 0,
          activitySequence: 1,
          externalSequence: 0,
          clinicNotificationSequence: 1,
          clinicUnreadEpoch: 0,
          clinicUnreadFloor: 0,
          lastActivityAt: '2020-01-01T00:00:00.000Z',
        },
        overrideAccess: true,
        depth: 0,
      })
      createdInquiryIds.push(String(inquiry.id))
      inquiries.push(inquiry)
    }
    const expected = { count: before.count + 105 }
    expect(await readClinicOpenInquiryInventory(clinicReqA)).toEqual(expected)
    expect(await readClinicOpenInquiryInventory(clinicReqB)).toEqual(expected)
    const first = inquiries[0]!
    const unchanged = await readClinicInquiryDetail(clinicReqA, { inquiryId: String(first.id) })
    await updateClinicInquiryReadPosition(clinicReqA, { inquiryId: String(first.id), mode: 'read' })
    expect(await readClinicOpenInquiryInventory(clinicReqA)).toEqual(expected)
    const after = await readClinicInquiryDetail(clinicReqA, { inquiryId: String(first.id) })
    expect(after.inquiry.handlingStatus).toBe(unchanged.inquiry.handlingStatus)
    expect(after.inquiry.revision).toBe(unchanged.inquiry.revision)
    expect((await readClinicOpenInquiryInventory(foreignClinicReq)).count).toBe(0)
  }, 60_000)

  it('rejects anonymous, foreign-target and revoked-assignment inventory reads', async () => {
    const anonymous = await createLocalReq({}, payload)
    await expect(readClinicOpenInquiryInventory(anonymous)).rejects.toMatchObject({ kind: 'unauthorized' })
    const foreign = await createLocalReq({}, payload)
    foreign.user = clinicReqA.user
    foreign.context = { inquiryClinicTargetId: String(foreignClinicId) }
    await expect(readClinicOpenInquiryInventory(foreign)).rejects.toMatchObject({ kind: 'access-denied' })
    const staffId = Number(clinicReqB.user!.id)
    await replaceClinicStaffAssignment(operator, staffId, { scope: 'unassigned' })
    await expect(readClinicOpenInquiryInventory(clinicReqB)).rejects.toMatchObject({ kind: 'access-denied' })
    await replaceClinicStaffAssignment(operator, staffId, { scope: 'local', clinicId })
  })

  it('includes existing open legacy records using the inquiry queue projection', async () => {
    const inquiry = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      overrideAccess: true,
      data: {
        clinic: clinicId,
        fullName: 'Synthetic legacy inventory',
        email: 'legacy@example.invalid',
        phoneNumber: '+493000000001',
        message: 'Synthetic legacy inquiry.',
        status: 'submitted',
        createdAt: '2020-01-01T00:00:00.000Z',
        consent: { accepted: true, acceptedAt: '2020-01-01T00:00:00.000Z', text: 'Synthetic consent.' },
      },
    })
    createdInquiryIds.push(String(inquiry.id))
    expect(await readClinicOpenInquiryInventory(clinicReqA)).toEqual({ count: 106 })
  })

  it('uses current group membership and rejects a detached clinic immediately', async () => {
    const group = await payload.create({
      collection: 'clinicGroups',
      data: { name: 'Synthetic inventory group' },
      req: operator,
      overrideAccess: false,
    })
    const staffId = Number(clinicReqB.user!.id)
    try {
      await payload.update({
        collection: 'clinics',
        id: clinicId,
        data: { group: group.id },
        overrideAccess: true,
        req: operator,
      })
      await replaceClinicStaffAssignment(operator, staffId, { scope: 'group', groupId: group.id })
      expect(await readClinicOpenInquiryInventory(clinicReqB)).toEqual({ count: 106 })
      await changeClinicGroup(operator, clinicId, { fromGroupId: group.id, toGroupId: null })
      await expect(readClinicOpenInquiryInventory(clinicReqB)).rejects.toMatchObject({ kind: 'access-denied' })
    } finally {
      await replaceClinicStaffAssignment(operator, staffId, { scope: 'local', clinicId })
      await payload.delete({ collection: 'clinicGroups', id: group.id, overrideAccess: false, req: operator })
    }
  })

  it('reflects newly stored, closed and reopened inquiries on the next authorized summary read', async () => {
    const before = await readClinicOpenInquiryInventory(clinicReqA)
    const inquiry = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      overrideAccess: true,
      data: {
        clinic: clinicId,
        fullName: 'Synthetic refresh inquiry',
        email: 'refresh@example.invalid',
        phoneNumber: '+493000000001',
        message: 'Synthetic current inventory transition.',
        status: 'submitted',
        handlingStatus: 'submitted',
        lifecycle: 'open',
        revision: 0,
        activitySequence: 1,
        externalSequence: 0,
        clinicNotificationSequence: 1,
        clinicUnreadEpoch: 0,
        clinicUnreadFloor: 0,
        lastActivityAt: '2020-01-01T00:00:00.000Z',
        consent: { accepted: true, acceptedAt: '2020-01-01T00:00:00.000Z', text: 'Synthetic consent.' },
      },
    })
    const inquiryId = String(inquiry.id)
    createdInquiryIds.push(inquiryId)
    expect(await readClinicOpenInquiryInventory(clinicReqA)).toEqual({ count: before.count + 1 })
    const detail = await readClinicInquiryDetail(clinicReqA, { inquiryId })
    const closed = await updateClinicInquiryState(clinicReqA, {
      action: 'close',
      inquiryId,
      expectedRevision: detail.inquiry.revision,
    })
    expect(await readClinicOpenInquiryInventory(clinicReqA)).toEqual(before)
    await updateClinicInquiryState(clinicReqA, {
      action: 'reopen',
      inquiryId,
      expectedRevision: closed.inquiry.revision,
    })
    expect(await readClinicOpenInquiryInventory(clinicReqA)).toEqual({ count: before.count + 1 })
    const after = await readClinicInquiryDetail(clinicReqA, { inquiryId })
    expect(after.inquiry.handlingStatus).toBe('submitted')
    expect(after.inquiry.unread).toEqual(detail.inquiry.unread)
  })

  it('excludes stored retention states and package deletion proofs from the open inventory', async () => {
    const before = await readClinicOpenInquiryInventory(clinicReqA)
    for (const variant of [
      'available',
      'anonymized',
      'hard-deleted',
      'anonymization-proof',
      'hard-delete-pending',
      'hard-delete-proof',
    ] as const) {
      const inquiry = await payload.create({
        collection: 'patientClinicInquiries',
        context: { inquiryCommunicationCommand: true, inquiryRetentionCommand: true },
        overrideAccess: true,
        data: {
          clinic: clinicId,
          fullName: 'Synthetic retention patient',
          email: 'retention@example.invalid',
          phoneNumber: '+493000000001',
          message: 'Synthetic retention inquiry.',
          status: 'submitted',
          handlingStatus: 'submitted',
          lifecycle: 'open',
          retentionState: variant === 'anonymized' || variant === 'hard-deleted' ? variant : 'available',
          consent: { accepted: true, acceptedAt: '2020-01-01T00:00:00.000Z', text: 'Synthetic consent.' },
        },
      })
      createdInquiryIds.push(String(inquiry.id))
      if (variant === 'anonymization-proof' || variant === 'hard-delete-pending' || variant === 'hard-delete-proof') {
        const operation =
          variant === 'anonymization-proof'
            ? 'anonymized'
            : variant === 'hard-delete-proof'
              ? 'hard-deleted'
              : 'hard-delete-pending'
        await payload.create({
          collection: 'inquiryDeletionProofs',
          overrideAccess: true,
          context: { inquiryRetentionCommand: true },
          data: {
            inquiryId: String(inquiry.id),
            operation,
            performedBy: Number(operator.user!.id),
            performedAt: '2020-01-01T00:00:00.000Z',
            policyVersion: 'synthetic',
            reasonCategory: 'authorized-erasure',
            deletedObjectCount: 0,
            tombstoneKey: inquiryPackageTombstoneKey(
              inquiry.id,
              operation === 'anonymized' ? 'anonymized' : 'hard-deleted',
            ),
          },
        })
      }
    }
    expect(await readClinicOpenInquiryInventory(clinicReqA)).toEqual({ count: before.count + 1 })
  }, 60_000)

  it('fails closed when the native source cannot establish a complete count', async () => {
    const count = vi.spyOn(payload, 'count').mockRejectedValueOnce(new Error('Synthetic database read failure'))
    try {
      await expect(readClinicOpenInquiryInventory(clinicReqA)).rejects.toThrow()
    } finally {
      count.mockRestore()
    }
  })

  it('fails closed when deletion proof visibility cannot be established', async () => {
    const original = payload.count.bind(payload)
    const count = vi.spyOn(payload, 'count').mockImplementation(async (options) => {
      if (options.collection === 'inquiryDeletionProofs') throw new Error('Synthetic proof read failure')
      return original(options)
    })
    try {
      await expect(readClinicOpenInquiryInventory(clinicReqA)).rejects.toThrow('Synthetic proof read failure')
    } finally {
      count.mockRestore()
    }
  })
})
