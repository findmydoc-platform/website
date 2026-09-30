import { describe, expect, it, vi } from 'vitest'
import {
  createCommandCatalog,
  dispatchCommandPreparation,
  type CatalogEntry,
  type CommandCatalog,
  type RecipientBinding,
} from '@/features/transactionalEmail/catalog'
import { commandTypes, type CommandType, type TransactionalEmailCommand } from '@/features/transactionalEmail/commands'
import type { PreparedMessage } from '@/features/transactionalEmail/preparation'

type CommandOf<Type extends TransactionalEmailCommand['type']> = Extract<TransactionalEmailCommand, { type: Type }>

type ConformanceProps<Type extends CommandType> = Readonly<
  { commandType: Type; actionLink?: string } & Record<string, unknown>
>

function createConformanceCase<Type extends CommandType>(input: {
  command: CommandOf<Type>
  expectedProps: ConformanceProps<Type>
  needsLink: boolean
  projectProps(command: CommandOf<Type>): ConformanceProps<Type>
}) {
  const recipient: RecipientBinding = Object.freeze({
    address: `${input.command.type.replaceAll('.', '-')}@example.test`,
    binding: `recipient:${input.command.type}`,
  })
  const authorizeAndResolve = vi.fn(async (_command: CommandOf<Type>, _actor: string | null) => recipient)
  const revalidateRecipient = vi.fn(async (_command: CommandOf<Type>) => recipient)
  const createLink = vi.fn(async (_command: CommandOf<Type>) => 'https://example.test/closed-action')
  const projectProps = vi.fn(input.projectProps)
  const render = vi.fn(async (recipientAddress: string, props: ConformanceProps<Type>): Promise<PreparedMessage> => ({
    recipientAddress,
    subject: `renderer:${input.command.type}`,
    html: `<p>${JSON.stringify(props)}</p>`,
    text: JSON.stringify(props),
  }))
  const entry: CatalogEntry<CommandOf<Type>> = {
    authorizeAndResolve,
    async revalidate(command) {
      const currentRecipient = await revalidateRecipient(command)
      return {
        status: 'eligible',
        recipient: currentRecipient,
        prepare: async () => {
          const props = projectProps(command)
          return render(
            currentRecipient.address,
            input.needsLink ? { ...props, actionLink: await createLink(command) } : props,
          )
        },
      }
    },
  }
  return {
    ...input,
    recipient,
    entry,
    authorizeAndResolve,
    revalidateRecipient,
    createLink,
    projectProps,
    render,
  }
}

const conformanceCases = {
  'auth.email-verification': createConformanceCase({
    command: { type: 'auth.email-verification', authActionId: 11 },
    expectedProps: { commandType: 'auth.email-verification', authActionId: 11 },
    needsLink: true,
    projectProps: (command) => ({ commandType: command.type, authActionId: command.authActionId }),
  }),
  'auth.invitation': createConformanceCase({
    command: { type: 'auth.invitation', authActionId: 12 },
    expectedProps: { commandType: 'auth.invitation', authActionId: 12 },
    needsLink: true,
    projectProps: (command) => ({ commandType: command.type, authActionId: command.authActionId }),
  }),
  'auth.password-recovery': createConformanceCase({
    command: { type: 'auth.password-recovery', authActionId: 13 },
    expectedProps: { commandType: 'auth.password-recovery', authActionId: 13 },
    needsLink: true,
    projectProps: (command) => ({ commandType: command.type, authActionId: command.authActionId }),
  }),
  'conversation.external-message-received': createConformanceCase({
    command: { type: 'conversation.external-message-received', messageId: 14 },
    expectedProps: { commandType: 'conversation.external-message-received', messageId: 14 },
    needsLink: true,
    projectProps: (command) => ({ commandType: command.type, messageId: command.messageId }),
  }),
  'moderation.report-received': createConformanceCase({
    command: { type: 'moderation.report-received', moderationEventId: 15, recipientSlot: 'reporter' },
    expectedProps: { commandType: 'moderation.report-received', moderationEventId: 15, recipientSlot: 'reporter' },
    needsLink: true,
    projectProps: (command) => ({
      commandType: command.type,
      moderationEventId: command.moderationEventId,
      recipientSlot: command.recipientSlot,
    }),
  }),
  'moderation.report-decided': createConformanceCase({
    command: { type: 'moderation.report-decided', moderationEventId: 16, recipientSlot: 'affected' },
    expectedProps: { commandType: 'moderation.report-decided', moderationEventId: 16, recipientSlot: 'affected' },
    needsLink: true,
    projectProps: (command) => ({
      commandType: command.type,
      moderationEventId: command.moderationEventId,
      recipientSlot: command.recipientSlot,
    }),
  }),
  'moderation.appeal-received': createConformanceCase({
    command: { type: 'moderation.appeal-received', moderationEventId: 17, recipientSlot: 'appellant' },
    expectedProps: { commandType: 'moderation.appeal-received', moderationEventId: 17, recipientSlot: 'appellant' },
    needsLink: true,
    projectProps: (command) => ({
      commandType: command.type,
      moderationEventId: command.moderationEventId,
      recipientSlot: command.recipientSlot,
    }),
  }),
  'moderation.appeal-decided': createConformanceCase({
    command: { type: 'moderation.appeal-decided', moderationEventId: 18, recipientSlot: 'reporter' },
    expectedProps: { commandType: 'moderation.appeal-decided', moderationEventId: 18, recipientSlot: 'reporter' },
    needsLink: true,
    projectProps: (command) => ({
      commandType: command.type,
      moderationEventId: command.moderationEventId,
      recipientSlot: command.recipientSlot,
    }),
  }),
  'clinic.registration-received': createConformanceCase({
    command: { type: 'clinic.registration-received', registrationId: 19 },
    expectedProps: { commandType: 'clinic.registration-received', registrationId: 19 },
    needsLink: false,
    projectProps: (command) => ({ commandType: command.type, registrationId: command.registrationId }),
  }),
} satisfies {
  [Type in CommandType]: {
    command: CommandOf<Type>
    entry: CatalogEntry<CommandOf<Type>>
  }
}

const catalog = Object.fromEntries(commandTypes.map((type) => [type, conformanceCases[type].entry])) as CommandCatalog
const clinicConformanceRecipient = conformanceCases['clinic.registration-received'].recipient

describe('transactional email catalog dispatch', () => {
  it.each(commandTypes)('dispatches %s through its complete typed entry contract', async (type) => {
    const testCase = conformanceCases[type] as ReturnType<typeof createConformanceCase<CommandType>>
    for (const candidate of Object.values(conformanceCases)) {
      candidate.authorizeAndResolve.mockClear()
      candidate.revalidateRecipient.mockClear()
      candidate.createLink.mockClear()
      candidate.projectProps.mockClear()
      candidate.render.mockClear()
    }

    await expect(testCase.entry.authorizeAndResolve(testCase.command, 'actor:conformance')).resolves.toEqual(
      testCase.recipient,
    )
    expect(testCase.authorizeAndResolve).toHaveBeenCalledWith(testCase.command, 'actor:conformance')

    const decision = await dispatchCommandPreparation({
      catalog,
      command: testCase.command,
      storedRecipientAddress: testCase.recipient.address,
      storedRecipientDigest: `digest:${testCase.recipient.binding}`,
      digestRecipient: (current) => `digest:${current.binding}`,
    })

    expect(decision.status).toBe('eligible')
    if (decision.status !== 'eligible') return

    const prepared = await decision.prepare()
    const expectedProps = testCase.needsLink
      ? { ...testCase.expectedProps, actionLink: 'https://example.test/closed-action' }
      : testCase.expectedProps
    expect(prepared).toEqual({
      recipientAddress: testCase.recipient.address,
      subject: `renderer:${type}`,
      html: `<p>${JSON.stringify(expectedProps)}</p>`,
      text: JSON.stringify(expectedProps),
    })
    expect(testCase.revalidateRecipient).toHaveBeenCalledWith(testCase.command)
    expect(testCase.projectProps).toHaveBeenCalledWith(testCase.command)
    expect(testCase.createLink).toHaveBeenCalledTimes(testCase.needsLink ? 1 : 0)
    expect(testCase.render).toHaveBeenCalledWith(testCase.recipient.address, expectedProps)
    for (const [candidateType, candidate] of Object.entries(conformanceCases))
      expect(candidate.render).toHaveBeenCalledTimes(candidateType === type ? 1 : 0)
  })

  it.each([
    ['changed address', { address: 'changed@example.test', binding: clinicConformanceRecipient.binding }],
    ['changed binding', { address: clinicConformanceRecipient.address, binding: 'recipient:changed' }],
  ] as const)('maps a %s to recipient-changed before preparation', async (_, currentRecipient) => {
    const prepare = vi.fn()
    const changedCatalog: CommandCatalog = {
      'clinic.registration-received': {
        authorizeAndResolve: async () => clinicConformanceRecipient,
        revalidate: async () => ({ status: 'eligible', recipient: currentRecipient, prepare }),
      },
    }

    await expect(
      dispatchCommandPreparation({
        catalog: changedCatalog,
        command: conformanceCases['clinic.registration-received'].command,
        storedRecipientAddress: clinicConformanceRecipient.address,
        storedRecipientDigest: `digest:${clinicConformanceRecipient.binding}`,
        digestRecipient: (current) => `digest:${current.binding}`,
      }),
    ).resolves.toEqual({ status: 'suppressed', outcomeCode: 'recipient-changed' })
    expect(prepare).not.toHaveBeenCalled()
  })

  it.each(['ineligible', 'source-unavailable', 'superseded'] as const)(
    'preserves the closed %s suppression outcome',
    async (outcomeCode) => {
      const suppressedCatalog: CommandCatalog = {
        'clinic.registration-received': {
          authorizeAndResolve: async () => clinicConformanceRecipient,
          revalidate: async () => ({ status: 'suppressed', outcomeCode }),
        },
      }

      await expect(
        dispatchCommandPreparation({
          catalog: suppressedCatalog,
          command: conformanceCases['clinic.registration-received'].command,
          storedRecipientAddress: clinicConformanceRecipient.address,
          storedRecipientDigest: `digest:${clinicConformanceRecipient.binding}`,
          digestRecipient: (current) => `digest:${current.binding}`,
        }),
      ).resolves.toEqual({ status: 'suppressed', outcomeCode })
    },
  )
})

describe('clinic registration catalog entry', () => {
  it('owns recipient projection and package rendering without a link', async () => {
    const entry = createCommandCatalog({
      findClinicApplication: async () => ({
        id: 27,
        clinicName: 'Northwind Clinic',
        contactEmail: 'clinic@example.test',
        contactFirstName: 'Ada',
        contactLastName: 'Lovelace',
      }),
    })['clinic.registration-received']!

    const revalidation = await entry.revalidate({ type: 'clinic.registration-received', registrationId: 27 })

    expect(revalidation.status).toBe('eligible')
    if (revalidation.status !== 'eligible') return
    await expect(revalidation.prepare()).resolves.toMatchObject({
      recipientAddress: 'clinic@example.test',
      subject: 'We received your clinic registration',
    })
  })

  it.each([
    { caseName: 'missing source', source: null, outcomeCode: 'source-unavailable' },
    {
      caseName: 'missing recipient data',
      source: { id: 27, clinicName: 'Northwind Clinic', contactEmail: '', contactLastName: 'Lovelace' },
      outcomeCode: 'ineligible',
    },
  ] as const)('maps $caseName to $outcomeCode', async ({ source, outcomeCode }) => {
    const entry = createCommandCatalog({ findClinicApplication: async () => source })['clinic.registration-received']!

    await expect(entry.revalidate({ type: 'clinic.registration-received', registrationId: 27 })).resolves.toEqual({
      status: 'suppressed',
      outcomeCode,
    })
  })
})
