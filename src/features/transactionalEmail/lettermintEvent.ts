import { z } from 'zod'
import { commandTypes } from './commands'
import { TransactionalEmailError } from './errors'

const verifiedEvents = new WeakSet<object>()

/** Issued by the raw-signature boundary after projection and target verification. */
export function issueVerifiedLettermintEvent(event: VerifiedLettermintEvent): VerifiedLettermintEvent {
  if (event.recipientDigestCandidates) Object.freeze(event.recipientDigestCandidates)
  Object.freeze(event.envelope.data.metadata)
  Object.freeze(event.envelope.data)
  Object.freeze(event.envelope.context)
  Object.freeze(event.envelope)
  Object.freeze(event)
  verifiedEvents.add(event)
  return event
}

export function requireVerifiedLettermintEvent(event: VerifiedLettermintEvent) {
  if (!verifiedEvents.has(event)) throw new TransactionalEmailError('access-denied')
}

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
export const lettermintEventMapping = {
  'message.created': 'provider.created',
  'message.sent': 'provider.sent',
  'message.delivered': 'delivery.delivered',
  'message.hard_bounced': 'delivery.bounced',
  'message.soft_bounced': 'provider.soft-bounced',
  'message.spam_complaint': 'delivery.complained',
  'message.failed': 'provider.failed',
  'message.suppressed': 'provider.suppressed',
  'message.policy_rejected': 'provider.policy-rejected',
} as const

// Zod projects every object level; no provider content crosses this private seam.
export const lettermintMessageEnvelope = z
  .object({
    id: identifier,
    event: z
      .string()
      .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/)
      .max(128),
    timestamp: z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
    context: z.object({
      scope: z.literal('route'),
      team_id: identifier,
      project_id: identifier,
      route_id: identifier,
    }),
    data: z.object({
      message_id: identifier.optional(),
      recipient: z.unknown().optional(),
      metadata: z
        .object({
          operation_id: identifier.optional(),
          command_type: z.enum(commandTypes).optional(),
          environment: z.enum(['preview', 'production']).optional(),
        })
        .nullish(),
    }),
  })
  .refine(
    (event) =>
      event.event !== 'webhook.test' &&
      (!Object.hasOwn(lettermintEventMapping, event.event) || event.data.message_id !== undefined),
  )

type MessageEnvelope = z.infer<typeof lettermintMessageEnvelope>
export type VerifiedLettermintEvent = Readonly<{
  envelope: Omit<MessageEnvelope, 'context' | 'data'> & {
    context: Omit<MessageEnvelope['context'], 'scope'>
    data: Omit<MessageEnvelope['data'], 'recipient'>
  }
  environment: 'preview' | 'production'
  recipientDigest?: string
  recipientDigestCandidates?: readonly string[]
}>
