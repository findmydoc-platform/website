import { describe, expect, it } from 'vitest'
import { createCommandPort, type AcceptanceStorage, type NewOperation } from '@/features/transactionalEmail/acceptance'
import type { CatalogEntry, CommandCatalog } from '@/features/transactionalEmail/catalog'
import type { CommandType, TransactionalEmailCommand } from '@/features/transactionalEmail/commands'

const acceptedAt = '2026-09-30T08:00:00.000Z'

type AcceptanceTestCatalog = {
  readonly [Type in CommandType]?: Omit<CatalogEntry<Extract<TransactionalEmailCommand, { type: Type }>>, 'revalidate'>
}

function acceptanceHarness(catalog: AcceptanceTestCatalog) {
  const created: NewOperation[] = []
  const accepted = new Map<string, { id: number; createdAt: string }>()
  const storage: AcceptanceStorage = {
    find: async (commandType, operationReference) => accepted.get(`${commandType}\0${operationReference}`) ?? null,
    create: async (operation) => {
      created.push(operation)
      const result = { id: 7, createdAt: operation.acceptedAt }
      accepted.set(`${operation.command.type}\0${operation.operationReference}`, result)
      return result
    },
  }
  const commands = createCommandPort({
    actor: null,
    catalog: Object.fromEntries(
      Object.entries(catalog).map(([type, entry]) => [
        type,
        { ...entry, revalidate: async () => ({ status: 'suppressed', outcomeCode: 'ineligible' }) },
      ]),
    ) as CommandCatalog,
    digestRecipient: () => 'fake-v1:digest',
    environment: 'test',
    now: () => Date.parse(acceptedAt),
    transaction: async (work) => work(storage),
  })
  return { commands, created }
}

describe('transactional email command acceptance', () => {
  it('records expected report ineligibility as a terminal operation without a substitute address', async () => {
    const { commands, created } = acceptanceHarness({
      'moderation.report-received': {
        authorizeAndResolve: async () => ({
          status: 'suppressed' as const,
          binding: 'moderation-report-v1:exact-reporter:45',
          outcomeCode: 'ineligible' as const,
        }),
      },
    })
    const command = {
      type: 'moderation.report-received' as const,
      moderationEventId: 45,
      recipientSlot: 'reporter' as const,
    }
    const receipt = await commands.accept(command)
    await expect(commands.accept(command)).resolves.toEqual({ ...receipt, deduplicated: true })
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ recipientAddress: null, suppressionOutcome: 'ineligible' })
  })
  it('persists the versioned AuthAction identity for password recovery', async () => {
    const { commands, created } = acceptanceHarness({
      'auth.password-recovery': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'auth-action:41' }),
        authValidity: async () => ({ actionAt: acceptedAt, lifetimeMilliseconds: 3_600_000 }),
      },
    })

    await expect(commands.accept({ type: 'auth.password-recovery', authActionId: 41 })).resolves.toMatchObject({
      deduplicated: false,
    })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|auth-action|41',
      }),
    ])
  })

  it('persists the versioned AuthAction identity for email verification', async () => {
    const { commands, created } = acceptanceHarness({
      'auth.email-verification': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'auth-action:42' }),
        authValidity: async () => ({ actionAt: acceptedAt, lifetimeMilliseconds: 3_600_000 }),
      },
    })

    await expect(commands.accept({ type: 'auth.email-verification', authActionId: 42 })).resolves.toMatchObject({
      deduplicated: false,
    })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|auth-action|42',
      }),
    ])
  })

  it('persists the versioned AuthAction identity for an invitation', async () => {
    const { commands, created } = acceptanceHarness({
      'auth.invitation': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'auth-action:43' }),
        authValidity: async () => ({ actionAt: acceptedAt, lifetimeMilliseconds: 3_600_000 }),
      },
    })

    await expect(commands.accept({ type: 'auth.invitation', authActionId: 43 })).resolves.toMatchObject({
      deduplicated: false,
    })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|auth-action|43',
      }),
    ])
  })

  it('persists the versioned Conversation message identity', async () => {
    const { commands, created } = acceptanceHarness({
      'conversation.external-message-received': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'message:44' }),
      },
    })

    await expect(
      commands.accept({ type: 'conversation.external-message-received', messageId: 44 }),
    ).resolves.toMatchObject({ deduplicated: false })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|conversation-message|44',
      }),
    ])
  })

  it('persists the reporter slot for a received report', async () => {
    const { commands, created } = acceptanceHarness({
      'moderation.report-received': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'moderation-event:45' }),
      },
    })

    await expect(
      commands.accept({ type: 'moderation.report-received', moderationEventId: 45, recipientSlot: 'reporter' }),
    ).resolves.toMatchObject({ deduplicated: false })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|moderation-event|45|reporter',
      }),
    ])
  })

  it('persists the affected slot for a decided report', async () => {
    const { commands, created } = acceptanceHarness({
      'moderation.report-decided': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'moderation-event:46' }),
      },
    })

    await expect(
      commands.accept({ type: 'moderation.report-decided', moderationEventId: 46, recipientSlot: 'affected' }),
    ).resolves.toMatchObject({ deduplicated: false })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|moderation-event|46|affected',
      }),
    ])
  })

  it('persists the appellant slot for a received appeal', async () => {
    const { commands, created } = acceptanceHarness({
      'moderation.appeal-received': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'moderation-event:47' }),
      },
    })

    await expect(
      commands.accept({ type: 'moderation.appeal-received', moderationEventId: 47, recipientSlot: 'appellant' }),
    ).resolves.toMatchObject({ deduplicated: false })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|moderation-event|47|appellant',
      }),
    ])
  })

  it('persists the reporter slot for a decided appeal', async () => {
    const { commands, created } = acceptanceHarness({
      'moderation.appeal-decided': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'moderation-event:48' }),
      },
    })

    await expect(
      commands.accept({ type: 'moderation.appeal-decided', moderationEventId: 48, recipientSlot: 'reporter' }),
    ).resolves.toMatchObject({ deduplicated: false })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: 'v1|moderation-event|48|reporter',
      }),
    ])
  })

  it('accepts every secondary slot from the closed Moderation recipient matrix', async () => {
    const { commands, created } = acceptanceHarness({
      'moderation.report-decided': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'moderation-event:51' }),
      },
      'moderation.appeal-decided': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'moderation-event:52' }),
      },
    })

    await commands.accept({ type: 'moderation.report-decided', moderationEventId: 51, recipientSlot: 'reporter' })
    await commands.accept({ type: 'moderation.appeal-decided', moderationEventId: 52, recipientSlot: 'appellant' })

    expect(created.map(({ operationReference }) => operationReference)).toEqual([
      'v1|moderation-event|51|reporter',
      'v1|moderation-event|52|appellant',
    ])
  })

  it('preserves the existing Clinic Registration operation reference', async () => {
    const { commands, created } = acceptanceHarness({
      'clinic.registration-received': {
        isRecipientAllowed: () => true,
        authorizeAndResolve: async () => ({ address: 'clinic@example.test', binding: 'clinic-registration:49' }),
      },
    })

    await expect(commands.accept({ type: 'clinic.registration-received', registrationId: 49 })).resolves.toMatchObject({
      deduplicated: false,
    })
    expect(created).toEqual([
      expect.objectContaining({
        operationReference: '49',
      }),
    ])
  })

  it('deduplicates repeated acceptance of the same composed Moderation identity', async () => {
    const { commands, created } = acceptanceHarness({
      'moderation.report-decided': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: 'moderation-event:50' }),
      },
    })
    const command = {
      type: 'moderation.report-decided' as const,
      moderationEventId: 50,
      recipientSlot: 'reporter' as const,
    }

    const accepted = await commands.accept(command)

    await expect(commands.accept(command)).resolves.toEqual({ ...accepted, deduplicated: true })
    expect(created).toHaveLength(1)
  })

  it('rejects the former caller-supplied Clinic operation reference', async () => {
    const { commands, created } = acceptanceHarness({
      'clinic.registration-received': {
        isRecipientAllowed: () => true,
        authorizeAndResolve: async () => ({ address: 'clinic@example.test', binding: 'clinic-registration' }),
      },
    })

    await expect(
      commands.accept({
        type: 'clinic.registration-received',
        operationReference: '00000000-0000-4000-8000-000000000001',
        registrationId: '00000000-0000-4000-8000-000000000002',
      } as never),
    ).rejects.toMatchObject({ code: 'invalid-command' })
    expect(created).toEqual([])
  })

  it.each([
    ['zero AuthAction ID', { type: 'auth.password-recovery', authActionId: 0 }],
    ['fractional AuthAction ID', { type: 'auth.invitation', authActionId: 1.5 }],
    ['string Conversation ID', { type: 'conversation.external-message-received', messageId: '44' }],
    [
      'cross-command report slot',
      { type: 'moderation.report-received', moderationEventId: 45, recipientSlot: 'affected' },
    ],
    [
      'cross-command appeal slot',
      { type: 'moderation.appeal-received', moderationEventId: 47, recipientSlot: 'reporter' },
    ],
    [
      'free-form operation reference',
      { type: 'auth.email-verification', authActionId: 42, operationReference: 'caller-controlled' },
    ],
    ['legacy source field', { type: 'auth.password-recovery', recoveryId: 'legacy' }],
    ['string Clinic ID', { type: 'clinic.registration-received', registrationId: '49' }],
  ])('rejects %s before persistence', async (_, input) => {
    const { commands, created } = acceptanceHarness({})

    await expect(commands.accept(input as never)).rejects.toMatchObject({ code: 'invalid-command' })
    expect(created).toEqual([])
  })
})
