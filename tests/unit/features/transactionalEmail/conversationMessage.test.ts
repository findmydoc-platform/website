import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createCommandPort, type NewOperation } from '@/features/transactionalEmail/acceptance'
import { dispatchCommandPreparation } from '@/features/transactionalEmail/catalog'
import { bindPayloadCommandCatalog } from '@/features/transactionalEmail/payloadCatalog'
import { inquiryContentTombstoneKey, inquiryPackageTombstoneKey } from '@/features/inquiryAggregate/tombstones'

const command = { type: 'conversation.external-message-received' as const, messageId: 44 }
const inquiryId = '00000000-0000-4000-8000-000000000081'

function fixture(actor: string | null = 'clinicStaff:9') {
  const unavailable = new Set<string>()
  const proofs: Record<string, unknown>[] = []
  const cases: Record<string, unknown>[] = []
  const records: Record<
    'inquiryMessages' | 'patientClinicInquiries' | 'inquiryConversations' | 'patients' | 'inquiryAttachments',
    Record<string, unknown>
  > = {
    inquiryMessages: {
      id: 44,
      inquiry: inquiryId,
      conversation: 31,
      clinic: 5,
      patient: 61,
      authorKind: 'clinic',
      authorClinicStaff: 9,
      contentState: 'available',
      text: 'Private treatment context',
      attachment: 71,
    },
    patientClinicInquiries: {
      id: inquiryId,
      clinic: 5,
      patient: 61,
      retentionState: 'available',
      lifecycle: 'open',
      email: 'historical@example.test',
      fullName: 'Private patient name',
    },
    inquiryConversations: { id: 31, inquiry: inquiryId, clinic: 5, patient: 61 },
    patients: { id: 61, email: 'patient@example.test', firstName: 'Private patient name' },
    inquiryAttachments: {
      id: 71,
      inquiry: inquiryId,
      clinic: 5,
      patient: 61,
      boundMessage: 44,
      state: 'bound',
      contentState: 'available',
      verifiedMimeType: 'application/pdf',
    },
  }
  const payload = {
    async findByID({ collection, id }: { collection: keyof typeof records; id: string | number }) {
      const record = records[collection]
      if (!record || unavailable.has(collection) || String(record.id) !== String(id))
        throw Object.assign(new Error('Missing fixture'), { status: 404 })
      return record
    },
    async find({ collection, where }: { collection: string; where: Record<string, unknown> }) {
      function matches(record: Record<string, unknown>, conditions: Record<string, unknown>): boolean {
        if (Array.isArray(conditions.and)) return conditions.and.every((condition) => matches(record, condition))
        return Object.entries(conditions).every(([field, predicate]) => {
          const condition = predicate as { equals?: unknown; in?: unknown[]; exists?: boolean }
          if ('equals' in condition) return record[field] === condition.equals
          if ('in' in condition) return condition.in!.includes(record[field])
          if ('exists' in condition) return (record[field] !== undefined && record[field] !== null) === condition.exists
          return false
        })
      }
      return {
        docs: (collection === 'inquiryDeletionProofs'
          ? proofs
          : collection === 'inquiryModerationCases'
            ? cases
            : []
        ).filter((record) => matches(record, where)),
        hasNextPage: false,
      }
    },
  }
  const req = { payload } as unknown as PayloadRequest
  const operations: NewOperation[] = []
  const catalog = bindPayloadCommandCatalog(req)
  const commands = createCommandPort({
    catalog,
    actor,
    environment: 'test',
    digestRecipient: (recipient) => recipient.binding,
    transaction: async (work) =>
      work({
        find: async () => null,
        create: async (operation) => {
          operations.push(operation)
          return { id: 7, createdAt: operation.acceptedAt }
        },
      }),
  })
  return { records, req, catalog, commands, operations, unavailable, proofs, cases }
}

describe('conversation notification command preparation', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    ['preview', 'https://preview.findmydoc.eu'],
    ['production', 'https://findmydoc.eu'],
    ['local', 'http://localhost:3000'],
    ['ci', 'https://example.test'],
  ])('uses the trusted %s Website origin, never the caller-provided server URL', async (environment, origin) => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CI', 'false')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', environment)
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://untrusted.example.test')
    const { commands, operations, catalog } = fixture()
    await commands.accept(command)
    const accepted = operations[0]!
    const decision = await dispatchCommandPreparation({
      catalog,
      command,
      storedRecipientAddress: accepted.recipientAddress,
      storedRecipientDigest: accepted.recipientDigest,
      digestRecipient: (recipient) => recipient.binding,
    })
    if (decision.status !== 'eligible') throw new Error('Expected an eligible conversation notice')
    const prepared = await decision.prepare()
    expect(prepared.html).toContain(`href="${origin}/patient/inquiries/${inquiryId}"`)
    expect(prepared.html).not.toContain('untrusted.example.test')
  })

  it('accepts the clinic message and renders only the protected inquiry link for the current patient', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('CI', 'false')
    const { commands, operations, catalog } = fixture()
    await commands.accept(command)
    const operation = operations[0]!
    const decision = await dispatchCommandPreparation({
      catalog,
      command,
      storedRecipientAddress: operation.recipientAddress,
      storedRecipientDigest: operation.recipientDigest,
      digestRecipient: (recipient) => recipient.binding,
    })
    if (decision.status !== 'eligible') throw new Error('Expected an eligible conversation notice')
    const prepared = await decision.prepare()
    expect(prepared.recipientAddress).toBe('patient@example.test')
    expect(prepared.subject).toBe('You have a new message on findmydoc')
    expect(prepared.text).toContain('A clinic sent you a new message. Sign in to findmydoc to view it.')
    expect(prepared.text).toContain('View message')
    expect(prepared.html).toContain(`href="https://example.test/patient/inquiries/${inquiryId}"`)
    expect(prepared.text).not.toContain('Private')
    expect(prepared.html).not.toContain('Private')
    expect(prepared.text).not.toContain('historical@example.test')
    expect(prepared.subject).not.toContain(inquiryId)
    const actionUrl = `https://example.test/patient/inquiries/${inquiryId}`
    expect(prepared.html.replaceAll(actionUrl, '')).not.toContain(inquiryId)
    expect(prepared.text.replaceAll(actionUrl, '')).not.toContain(inquiryId)
  })

  it.each([null, 'patients:61', 'platformStaff:9', 'clinicStaff:10'])(
    'denies command acceptance to %s without exposing an operation',
    async (actor) => {
      const { commands, operations } = fixture(actor)
      await expect(commands.accept(command)).rejects.toMatchObject({ code: 'access-denied' })
      expect(operations).toEqual([])
    },
  )

  it('accepts an authorized clinic notification as terminally ineligible without inventing a recipient address', async () => {
    const { commands, records, operations } = fixture()
    records.patients.email = ''
    await expect(commands.accept(command)).resolves.toMatchObject({ operationId: '7', deduplicated: false })
    expect(operations).toHaveLength(1)
    expect(operations[0]).toMatchObject({ recipientAddress: null, suppressionOutcome: 'ineligible' })
  })

  it.each([null, 'patients:61', 'clinicStaff:10'])(
    'denies terminal acceptance to %s before recipient eligibility is considered',
    async (actor) => {
      const { commands, records, operations } = fixture(actor)
      records.patients.email = ''
      await expect(commands.accept(command)).rejects.toMatchObject({ code: 'access-denied' })
      expect(operations).toEqual([])
    },
  )

  it('does not accept an unknown message as a terminal operation', async () => {
    const { commands, operations, unavailable } = fixture()
    unavailable.add('inquiryMessages')
    await expect(commands.accept(command)).rejects.toMatchObject({ code: 'source-missing' })
    expect(operations).toEqual([])
  })

  it('suppresses an accepted message when the current patient no longer has an email address', async () => {
    const { commands, operations, catalog, records } = fixture()
    await commands.accept(command)
    records.patients.email = ''
    const operation = operations[0]!
    await expect(
      dispatchCommandPreparation({
        catalog,
        command,
        storedRecipientAddress: operation.recipientAddress,
        storedRecipientDigest: operation.recipientDigest,
        digestRecipient: (recipient) => recipient.binding,
      }),
    ).resolves.toEqual({ status: 'suppressed', outcomeCode: 'ineligible' })
  })

  it.each([
    ['inquiryMessages', 'source-unavailable'],
    ['patientClinicInquiries', 'ineligible'],
    ['inquiryConversations', 'ineligible'],
    ['patients', 'ineligible'],
  ])('suppresses an accepted notice when %s becomes unavailable', async (collection, outcomeCode) => {
    const { commands, operations, catalog, unavailable } = fixture()
    await commands.accept(command)
    unavailable.add(collection)
    const operation = operations[0]!
    await expect(
      dispatchCommandPreparation({
        catalog,
        command,
        storedRecipientAddress: operation.recipientAddress,
        storedRecipientDigest: operation.recipientDigest,
        digestRecipient: (recipient) => recipient.binding,
      }),
    ).resolves.toEqual({ status: 'suppressed', outcomeCode })
  })

  it.each([
    ['patient author', 'inquiryMessages', 'authorKind', 'patient'],
    ['internal author', 'inquiryMessages', 'authorKind', 'internal'],
    ['anonymized inquiry', 'patientClinicInquiries', 'retentionState', 'anonymized'],
    ['deleted inquiry', 'patientClinicInquiries', 'retentionState', 'hard-deleted'],
    ['removed patient binding', 'patientClinicInquiries', 'patient', null],
    ['foreign conversation', 'inquiryConversations', 'inquiry', 'foreign-inquiry'],
    ['foreign clinic', 'inquiryConversations', 'clinic', 6],
  ] as const)('suppresses an accepted notice after %s', async (_, collection, field, value) => {
    const { commands, operations, catalog, records } = fixture()
    await commands.accept(command)
    records[collection][field] = value
    const operation = operations[0]!
    await expect(
      dispatchCommandPreparation({
        catalog,
        command,
        storedRecipientAddress: operation.recipientAddress,
        storedRecipientDigest: operation.recipientDigest,
        digestRecipient: (recipient) => recipient.binding,
      }),
    ).resolves.toEqual({ status: 'suppressed', outcomeCode: 'ineligible' })
  })

  it.each([
    ['address', 'patients', 'email', 'changed@example.test'],
    ['message participant', 'inquiryMessages', 'patient', 62],
    ['conversation participant', 'inquiryConversations', 'patient', 62],
  ] as const)('never redirects an accepted notice after changing the %s', async (_, collection, field, value) => {
    const { commands, operations, catalog, records } = fixture()
    await commands.accept(command)
    records[collection][field] = value
    const operation = operations[0]!
    await expect(
      dispatchCommandPreparation({
        catalog,
        command,
        storedRecipientAddress: operation.recipientAddress,
        storedRecipientDigest: operation.recipientDigest,
        digestRecipient: (recipient) => recipient.binding,
      }),
    ).resolves.toEqual({ status: 'suppressed', outcomeCode: 'recipient-changed' })
  })

  it.each([
    ['trashed message', 'inquiryMessages', 'deletedAt', '2026-10-06T00:00:00.000Z', 'source-unavailable'],
    ['trashed inquiry', 'patientClinicInquiries', 'deletedAt', '2026-10-06T00:00:00.000Z', 'ineligible'],
    ['trashed conversation', 'inquiryConversations', 'deletedAt', '2026-10-06T00:00:00.000Z', 'ineligible'],
    ['hard-deleted message', 'inquiryMessages', 'contentState', 'hard-deleted', 'ineligible'],
  ] as const)('suppresses after %s', async (_, collection, field, value, outcomeCode) => {
    const { commands, operations, catalog, records } = fixture()
    await commands.accept(command)
    records[collection][field] = value
    const operation = operations[0]!
    await expect(
      dispatchCommandPreparation({
        catalog,
        command,
        storedRecipientAddress: operation.recipientAddress,
        storedRecipientDigest: operation.recipientDigest,
        digestRecipient: (recipient) => recipient.binding,
      }),
    ).resolves.toEqual({ status: 'suppressed', outcomeCode })
  })

  it.each(['anonymized', 'hard-delete-pending', 'hard-deleted', 'message-tombstone'] as const)(
    'honors authoritative %s retention proof even before the denormalized state catches up',
    async (operation) => {
      const { commands, operations, catalog, proofs } = fixture()
      await commands.accept(command)
      proofs.push({
        inquiryId,
        operation: operation === 'message-tombstone' ? 'hard-delete-pending' : operation,
        tombstoneKey:
          operation === 'message-tombstone'
            ? inquiryContentTombstoneKey(inquiryId, 'message', 44)
            : inquiryPackageTombstoneKey(inquiryId, operation === 'anonymized' ? 'anonymized' : 'hard-deleted'),
      })
      const accepted = operations[0]!
      await expect(
        dispatchCommandPreparation({
          catalog,
          command,
          storedRecipientAddress: accepted.recipientAddress,
          storedRecipientDigest: accepted.recipientDigest,
          digestRecipient: (recipient) => recipient.binding,
        }),
      ).resolves.toEqual({ status: 'suppressed', outcomeCode: 'ineligible' })
    },
  )

  it('suppresses a restricted triggering message', async () => {
    const { commands, operations, catalog, cases } = fixture()
    await commands.accept(command)
    cases.push({
      id: 91,
      inquiry: inquiryId,
      decisionAt: '2026-10-06T00:00:00.000Z',
      decisionOutcome: 'content-restricted',
      targetType: 'message',
      targetMessage: 44,
    })
    const accepted = operations[0]!
    await expect(
      dispatchCommandPreparation({
        catalog,
        command,
        storedRecipientAddress: accepted.recipientAddress,
        storedRecipientDigest: accepted.recipientDigest,
        digestRecipient: (recipient) => recipient.binding,
      }),
    ).resolves.toEqual({ status: 'suppressed', outcomeCode: 'ineligible' })
  })

  it.each(['conversation-restricted', 'identity-messaging-suspended'])(
    'does not mistake the %s write restriction or a closed inquiry for lost read access',
    async (decisionOutcome) => {
      const { commands, operations, catalog, cases, records } = fixture()
      await commands.accept(command)
      records.patientClinicInquiries.lifecycle = 'closed'
      cases.push({
        id: 91,
        inquiry: inquiryId,
        decisionAt: '2026-10-06T00:00:00.000Z',
        decisionOutcome,
        affectedActorKind: 'patient',
        affectedPatient: 61,
      })
      const accepted = operations[0]!
      const decision = await dispatchCommandPreparation({
        catalog,
        command,
        storedRecipientAddress: accepted.recipientAddress,
        storedRecipientDigest: accepted.recipientDigest,
        digestRecipient: (recipient) => recipient.binding,
      })
      expect(decision.status).toBe('eligible')
    },
  )

  it.each(['restricted', 'hard-deleted', 'unavailable'])(
    'suppresses an attachment-only message when its attachment becomes %s',
    async (state) => {
      const { commands, operations, catalog, cases, records, unavailable } = fixture()
      records.inquiryMessages.text = ''
      await commands.accept(command)
      if (state === 'restricted')
        cases.push({
          id: 91,
          inquiry: inquiryId,
          decisionAt: '2026-10-06T00:00:00.000Z',
          decisionOutcome: 'content-restricted',
          targetType: 'attachment',
          targetAttachment: 71,
        })
      else if (state === 'hard-deleted') records.inquiryAttachments.contentState = 'hard-deleted'
      else unavailable.add('inquiryAttachments')
      const accepted = operations[0]!
      await expect(
        dispatchCommandPreparation({
          catalog,
          command,
          storedRecipientAddress: accepted.recipientAddress,
          storedRecipientDigest: accepted.recipientDigest,
          digestRecipient: (recipient) => recipient.binding,
        }),
      ).resolves.toEqual({ status: 'suppressed', outcomeCode: 'ineligible' })
    },
  )

  it('still notifies when a restricted attachment leaves the clinic message text readable', async () => {
    const { commands, operations, catalog, cases } = fixture()
    await commands.accept(command)
    cases.push({
      id: 91,
      inquiry: inquiryId,
      decisionAt: '2026-10-06T00:00:00.000Z',
      decisionOutcome: 'content-restricted',
      targetType: 'attachment',
      targetAttachment: 71,
    })
    const accepted = operations[0]!
    const decision = await dispatchCommandPreparation({
      catalog,
      command,
      storedRecipientAddress: accepted.recipientAddress,
      storedRecipientDigest: accepted.recipientDigest,
      digestRecipient: (recipient) => recipient.binding,
    })
    expect(decision.status).toBe('eligible')
  })

  it('restores delivery eligibility after the message content restriction is overturned', async () => {
    const { commands, operations, catalog, cases } = fixture()
    await commands.accept(command)
    cases.push({
      id: 91,
      inquiry: inquiryId,
      decisionAt: '2026-10-06T00:00:00.000Z',
      decisionOutcome: 'content-restricted',
      targetType: 'message',
      targetMessage: 44,
      appealOutcome: 'overturned',
    })
    const accepted = operations[0]!
    const decision = await dispatchCommandPreparation({
      catalog,
      command,
      storedRecipientAddress: accepted.recipientAddress,
      storedRecipientDigest: accepted.recipientDigest,
      digestRecipient: (recipient) => recipient.binding,
    })
    expect(decision.status).toBe('eligible')
  })
})
