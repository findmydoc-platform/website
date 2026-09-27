import { z } from 'zod'
import { commandTypes } from './commands'
import { TransactionalEmailError } from './errors'

export const deliveryEdgeLogFields = [
  'operationId',
  'commandType',
  'environment',
  'attemptNumber',
  'outcomeCode',
  'outboxState',
  'providerMessageId',
  'providerEventId',
  'providerEventType',
  'durationBucket',
  'queueAgeBucket',
] as const

export const deliveryEdgeMetricDimensions = [
  'commandType',
  'environment',
  'outcomeCode',
  'outboxState',
  'providerEventType',
  'durationBucket',
  'queueAgeBucket',
] as const

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const operationId = z.string().regex(/^[1-9][0-9]{0,9}$/)
const environment = z.enum(['local', 'test', 'ci', 'preview', 'production'])
const outboxState = z.enum([
  'queued',
  'prepared',
  'accepted',
  'delivered',
  'suppressed',
  'bounced',
  'complained',
  'failed',
  'expired',
])
const providerEventType = z.enum([
  'message.created',
  'message.sent',
  'message.delivered',
  'message.hard_bounced',
  'message.soft_bounced',
  'message.spam_complaint',
  'message.failed',
  'message.suppressed',
  'message.policy_rejected',
  'other',
])
const outcomeCode = z.enum([
  'fake-accepted',
  'provider-accepted',
  'provider-temporary',
  'provider-rate-limited',
  'provider-ambiguous',
  'provider-idempotency-conflict',
  'provider-request-in-progress',
  'provider-conflict-unknown',
  'provider-request-rejected',
  'provider-policy-rejected',
  'recipient-changed',
  'ineligible',
  'preparation-failed',
  'permanent-failure',
  'retryable-failure',
  'ambiguous',
  'expired',
  'command-not-enabled',
  'preview-recipient-not-allowed',
  'suppression-hit',
  'suppression-unavailable',
  'configuration-drift',
  'provider-event-applied',
  'provider-event-duplicate',
  'provider-event-unmatched',
  'provider-event-mismatch',
  'provider-event-ignored',
  'webhook-test-verified',
  'webhook-invalid',
  'webhook-unsupported-media',
  'webhook-too-large',
  'webhook-unavailable',
  'webhook-unauthorized',
  'webhook-target-mismatch',
])
const durationBucket = z.enum(['lt-1s', 'lt-5s', 'lt-20s', 'gte-20s'])
const queueAgeBucket = z.enum(['lt-1m', 'lt-5m', 'lt-30m', 'gte-30m'])

const logSchema = z
  .strictObject({
    operationId: operationId.optional(),
    commandType: z.enum(commandTypes).optional(),
    environment,
    attemptNumber: z.number().int().min(1).max(6).optional(),
    outcomeCode,
    outboxState: outboxState.optional(),
    providerMessageId: identifier.optional(),
    providerEventId: identifier.optional(),
    providerEventType: providerEventType.optional(),
    durationBucket: durationBucket.optional(),
    queueAgeBucket: queueAgeBucket.optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), { message: 'signal-required' })

const metricDimensionsSchema = z.strictObject({
  commandType: z.enum(commandTypes).optional(),
  environment,
  outcomeCode,
  outboxState: outboxState.optional(),
  providerEventType: providerEventType.optional(),
  durationBucket: durationBucket.optional(),
  queueAgeBucket: queueAgeBucket.optional(),
})

const metricSchema = z.strictObject({
  name: z.literal('transactional-email.delivery-edge.events'),
  dimensions: metricDimensionsSchema,
})

export type DeliveryEdgeLog = z.infer<typeof logSchema>
export type DeliveryEdgeMetric = z.infer<typeof metricSchema>
export type DeliveryEdgeMetricSink = (metric: DeliveryEdgeMetric) => void
export type DeliveryEdgeOutcomeCode = z.infer<typeof outcomeCode>
export type DeliveryEdgeProviderEventType = z.infer<typeof providerEventType>

function rejectInvalidSignal(): never {
  throw new TransactionalEmailError('invalid-command')
}

export function durationBucketFor(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) rejectInvalidSignal()
  if (milliseconds < 1_000) return 'lt-1s' as const
  if (milliseconds < 5_000) return 'lt-5s' as const
  if (milliseconds < 20_000) return 'lt-20s' as const
  return 'gte-20s' as const
}

export function queueAgeBucketFor(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) rejectInvalidSignal()
  if (milliseconds < 60_000) return 'lt-1m' as const
  if (milliseconds < 300_000) return 'lt-5m' as const
  if (milliseconds < 1_800_000) return 'lt-30m' as const
  return 'gte-30m' as const
}

export function safeProviderEventType(value: string): DeliveryEdgeProviderEventType {
  const parsed = providerEventType.safeParse(value)
  return parsed.success ? parsed.data : 'other'
}

function parseLog(value: unknown): DeliveryEdgeLog {
  const parsed = logSchema.safeParse(value)
  if (!parsed.success) rejectInvalidSignal()
  return Object.fromEntries(Object.entries(parsed.data).filter(([, entry]) => entry !== undefined)) as DeliveryEdgeLog
}

function parseMetric(value: unknown): DeliveryEdgeMetric {
  const parsed = metricSchema.safeParse(value)
  if (!parsed.success) rejectInvalidSignal()
  return parsed.data
}

export function validateDeliveryEdgeLog(value: unknown): DeliveryEdgeLog {
  return parseLog(value)
}

export function createDeliveryEdgeSignals({
  log,
  metric,
}: {
  log: (signal: DeliveryEdgeLog) => void
  metric?: DeliveryEdgeMetricSink
}) {
  const recordMetric = (value: unknown) => {
    const parsed = parseMetric(value)
    try {
      metric?.(parsed)
    } catch {
      // Operational telemetry must not alter a completed delivery decision.
    }
  }

  return {
    emit(value: unknown) {
      const signal = parseLog(value)
      try {
        log(signal)
      } catch {
        // Operational telemetry must not alter a completed delivery decision.
      }
      recordMetric({
        name: 'transactional-email.delivery-edge.events',
        dimensions: {
          ...(signal.commandType ? { commandType: signal.commandType } : {}),
          environment: signal.environment,
          outcomeCode: signal.outcomeCode,
          ...(signal.outboxState ? { outboxState: signal.outboxState } : {}),
          ...(signal.providerEventType ? { providerEventType: signal.providerEventType } : {}),
          ...(signal.durationBucket ? { durationBucket: signal.durationBucket } : {}),
          ...(signal.queueAgeBucket ? { queueAgeBucket: signal.queueAgeBucket } : {}),
        },
      })
    },
    recordMetric,
  }
}
