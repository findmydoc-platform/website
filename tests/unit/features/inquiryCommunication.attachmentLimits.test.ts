import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { createAttachmentDraft, INQUIRY_ATTACHMENT_DRAFT_LIMITS } from '@/features/inquiryCommunication/service'
import type { InquiryAttachmentStorageGateway } from '@/features/inquiryCommunication/storage'

const inquiry = {
  activitySequence: 1,
  clinic: 8,
  clinicNotificationSequence: 1,
  clinicUnreadEpoch: 0,
  clinicUnreadFloor: 0,
  createdAt: '2026-08-24T10:00:00.000Z',
  externalSequence: 0,
  handlingStatus: 'submitted',
  id: 42,
  lastActivityAt: '2026-08-24T10:00:00.000Z',
  lifecycle: 'open',
  patient: 77,
  revision: 0,
  updatedAt: '2026-08-24T10:00:00.000Z',
}

const createRequest = (counts: number[], events: string[] = []) => {
  const count = vi.fn(async (_args: Record<string, unknown>) => ({ totalDocs: counts.shift() ?? 0 }))
  const commitTransaction = vi.fn(async () => {
    events.push('commit')
  })
  const rollbackTransaction = vi.fn(async () => undefined)
  const create = vi.fn(async (args: { collection: string; data: Record<string, unknown> }) => {
    events.push(`create:${args.collection}`)
    return { id: args.collection === 'inquiryAttachments' ? 91 : 92, ...args.data }
  })
  const find = vi.fn(async (args: { collection: string }) => {
    if (args.collection === 'clinicStaff') {
      return {
        docs: [
          {
            authSync: { status: 'synced' },
            clinic: 8,
            email: 'staff@example.invalid',
            firstName: 'Synthetic',
            id: 5,
            lastName: 'Staff',
            status: 'approved',
          },
        ],
      }
    }
    if (args.collection === 'clinics') return { docs: [{ id: 8, name: 'Synthetic Clinic', status: 'approved' }] }
    if (args.collection === 'patientClinicInquiries') return { docs: [inquiry] }
    if (args.collection === 'inquiryConversations') return { docs: [{ clinic: 8, id: 88, inquiry: 42, patient: 77 }] }
    return { docs: [] }
  })
  const req = {
    context: {},
    headers: new Headers(),
    payload: {
      count,
      create,
      db: {
        beginTransaction: vi.fn(async () => 'tx-1'),
        commitTransaction,
        rollbackTransaction,
      },
      find,
      logger: { error: vi.fn() },
    },
    user: { collection: 'clinicStaff', id: 5 },
  } as unknown as PayloadRequest
  return { commitTransaction, count, create, req, rollbackTransaction }
}

const input = {
  fileName: 'synthetic.pdf',
  inquiryId: '42',
  mimeType: 'application/pdf' as const,
  sizeBytes: 4,
}

const storage = (events: string[] = []): InquiryAttachmentStorageGateway => ({
  createReadAccess: vi.fn(),
  createUpload: vi.fn(async () => {
    events.push('presign')
    return {
      headers: { 'content-type': 'application/pdf' },
      method: 'PUT' as const,
      url: 'https://storage.example.invalid/private-draft',
    }
  }),
  deleteObjects: vi.fn(),
  sealDraft: vi.fn(),
  verifySealed: vi.fn(),
})

describe('inquiry attachment draft limits', () => {
  it.each([
    ['active actor quota', [INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerActor]],
    ['active clinic quota', [0, INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerClinic]],
    ['actor reservation rate', [0, 0, INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerActor]],
    ['clinic reservation rate', [0, 0, 0, INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerClinic]],
  ] as const)('fails with rate-limited before presign at the %s', async (_case, counts) => {
    const { create, req } = createRequest([...counts])
    const gateway = storage()

    await expect(createAttachmentDraft(req, input, gateway)).rejects.toMatchObject({
      kind: 'rate-limited',
    })
    expect(gateway.createUpload).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'inquiryAttachments' }))
  })

  it('commits the bounded reservation before issuing the private upload URL', async () => {
    const events: string[] = []
    const { create, req } = createRequest([0, 0, 0, 0], events)
    const gateway = storage(events)

    await expect(createAttachmentDraft(req, input, gateway)).resolves.toMatchObject({ draftId: '91' })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'inquiryAttachments',
        data: expect.objectContaining({ actorKey: 'clinicStaff:5', clinic: 8, state: 'draft' }),
      }),
    )
    expect(events.indexOf('commit')).toBeGreaterThan(events.indexOf('create:inquiryAttachments'))
    expect(events.indexOf('presign')).toBeGreaterThan(events.indexOf('commit'))
  })

  it('uses the exact actor, clinic, active-state, and reservation-window scopes for all four limits', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'))
    try {
      const { count, req } = createRequest([0, 0, 0, 0])

      await expect(createAttachmentDraft(req, input, storage())).resolves.toMatchObject({ draftId: '91' })

      expect(count.mock.calls.map(([args]) => args.where)).toEqual([
        {
          and: [{ actorKey: { equals: 'clinicStaff:5' } }, { state: { in: ['draft', 'verified'] } }],
        },
        {
          and: [{ clinic: { equals: 8 } }, { state: { in: ['draft', 'verified'] } }],
        },
        {
          and: [
            { actorKey: { equals: 'clinicStaff:5' } },
            { objectCreatedAt: { greater_than_equal: '2026-08-24T11:45:00.000Z' } },
          ],
        },
        {
          and: [{ clinic: { equals: 8 } }, { objectCreatedAt: { greater_than_equal: '2026-08-24T11:45:00.000Z' } }],
        },
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns rate-limited after bounded serialization retries without issuing a presign', async () => {
    const { commitTransaction, req, rollbackTransaction } = createRequest(Array(12).fill(0))
    const gateway = storage()
    commitTransaction.mockRejectedValue({ code: '40001' })

    await expect(createAttachmentDraft(req, input, gateway)).rejects.toMatchObject({
      kind: 'rate-limited',
    })

    expect(commitTransaction).toHaveBeenCalledTimes(3)
    expect(rollbackTransaction).toHaveBeenCalledTimes(3)
    expect(gateway.createUpload).not.toHaveBeenCalled()
  })
})
