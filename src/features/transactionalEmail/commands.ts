import { z } from 'zod'
import { TransactionalEmailError } from './errors'

export const commandTypes = [
  'auth.email-verification',
  'auth.invitation',
  'auth.password-recovery',
  'conversation.external-message-received',
  'moderation.report-received',
  'moderation.report-decided',
  'moderation.appeal-received',
  'moderation.appeal-decided',
  'clinic.registration-received',
] as const

const positiveIdentifier = z.number().int().positive()

const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('auth.email-verification'), authActionId: positiveIdentifier }),
  z.strictObject({ type: z.literal('auth.invitation'), authActionId: positiveIdentifier }),
  z.strictObject({ type: z.literal('auth.password-recovery'), authActionId: positiveIdentifier }),
  z.strictObject({
    type: z.literal('conversation.external-message-received'),
    messageId: positiveIdentifier,
  }),
  z.strictObject({
    type: z.literal('moderation.report-received'),
    moderationEventId: positiveIdentifier,
    recipientSlot: z.literal('reporter'),
  }),
  z.strictObject({
    type: z.literal('moderation.report-decided'),
    moderationEventId: positiveIdentifier,
    recipientSlot: z.enum(['reporter', 'affected']),
  }),
  z.strictObject({
    type: z.literal('moderation.appeal-received'),
    moderationEventId: positiveIdentifier,
    recipientSlot: z.literal('appellant'),
  }),
  z.strictObject({
    type: z.literal('moderation.appeal-decided'),
    moderationEventId: positiveIdentifier,
    recipientSlot: z.enum(['appellant', 'reporter']),
  }),
  z.strictObject({ type: z.literal('clinic.registration-received'), registrationId: positiveIdentifier }),
])

export type TransactionalEmailCommand = z.infer<typeof commandSchema>
export type CommandType = TransactionalEmailCommand['type']

export function commandOperationReference(command: TransactionalEmailCommand): string {
  if (
    command.type === 'auth.email-verification' ||
    command.type === 'auth.invitation' ||
    command.type === 'auth.password-recovery'
  )
    return `v1|auth-action|${command.authActionId}`
  if (command.type === 'conversation.external-message-received') return `v1|conversation-message|${command.messageId}`
  if (
    command.type === 'moderation.report-received' ||
    command.type === 'moderation.report-decided' ||
    command.type === 'moderation.appeal-received' ||
    command.type === 'moderation.appeal-decided'
  )
    return `v1|moderation-event|${command.moderationEventId}|${command.recipientSlot}`
  return String(command.registrationId)
}

export function validateCommand(input: unknown): TransactionalEmailCommand {
  if (input && typeof input === 'object' && 'type' in input && !commandTypes.includes(input.type as CommandType)) {
    throw new TransactionalEmailError('unsupported-command')
  }
  const parsed = commandSchema.safeParse(input)
  if (!parsed.success) throw new TransactionalEmailError('invalid-command')
  return parsed.data
}
