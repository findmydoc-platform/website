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

const reference = z.uuid()
const common = { operationReference: reference }
const clinicApplicationIdentifier = z.number().int().positive()

// These identifiers bind synthetic source records. Product catalog entries remain owned by the flow issues.
const syntheticCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('auth.email-verification'), ...common, verificationId: reference }),
  z.strictObject({ type: z.literal('auth.invitation'), ...common, invitationId: reference }),
  z.strictObject({ type: z.literal('auth.password-recovery'), ...common, recoveryId: reference }),
  z.strictObject({ type: z.literal('conversation.external-message-received'), ...common, messageId: reference }),
  z.strictObject({ type: z.literal('moderation.report-received'), ...common, reportId: reference }),
  z.strictObject({ type: z.literal('moderation.report-decided'), ...common, decisionId: reference }),
  z.strictObject({ type: z.literal('moderation.appeal-received'), ...common, appealId: reference }),
  z.strictObject({ type: z.literal('moderation.appeal-decided'), ...common, decisionId: reference }),
  // The synthetic fixture keeps its UUID source contract.
  z.strictObject({ type: z.literal('clinic.registration-received'), ...common, registrationId: reference }),
])

// A real clinic application uses its existing numeric identifier for both the source and operation reference.
const commandSchema = z.union([
  syntheticCommandSchema,
  z.strictObject({ type: z.literal('clinic.registration-received'), registrationId: clinicApplicationIdentifier }),
])

export type TransactionalEmailCommand = z.infer<typeof commandSchema>
export type CommandType = TransactionalEmailCommand['type']

export function commandOperationReference(command: TransactionalEmailCommand): string {
  return 'operationReference' in command ? command.operationReference : String(command.registrationId)
}

export function validateCommand(input: unknown): TransactionalEmailCommand {
  if (input && typeof input === 'object' && 'type' in input && !commandTypes.includes(input.type as CommandType)) {
    throw new TransactionalEmailError('unsupported-command')
  }
  const parsed = commandSchema.safeParse(input)
  if (!parsed.success) throw new TransactionalEmailError('invalid-command')
  return parsed.data
}
