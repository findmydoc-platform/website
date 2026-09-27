import { describe, expect, it, vi } from 'vitest'
import {
  createDeliveryEdgeSignals,
  deliveryEdgeLogFields,
  deliveryEdgeMetricDimensions,
  durationBucketFor,
  queueAgeBucketFor,
} from '@/features/transactionalEmail/operationalSignals'

describe('transactional email operational signals', () => {
  const safeSignal = {
    operationId: '42',
    commandType: 'clinic.registration-received' as const,
    environment: 'test' as const,
    attemptNumber: 1,
    outcomeCode: 'provider-accepted' as const,
    outboxState: 'accepted' as const,
    providerMessageId: 'message-42',
    durationBucket: 'lt-1s' as const,
    queueAgeBucket: 'lt-1m' as const,
  }

  it('emits one closed log record and bounded metric dimensions', () => {
    const log = vi.fn()
    const metric = vi.fn()
    const signals = createDeliveryEdgeSignals({ log, metric })

    signals.emit(safeSignal)

    expect(log).toHaveBeenCalledWith(safeSignal)
    expect(metric).toHaveBeenCalledWith({
      name: 'transactional-email.delivery-edge.events',
      dimensions: {
        commandType: 'clinic.registration-received',
        environment: 'test',
        outcomeCode: 'provider-accepted',
        outboxState: 'accepted',
        providerEventType: undefined,
        durationBucket: 'lt-1s',
        queueAgeBucket: 'lt-1m',
      },
    })
  })

  it('rejects unapproved log fields and metric dimensions', () => {
    const signals = createDeliveryEdgeSignals({ log: vi.fn(), metric: vi.fn() })

    expect(() => signals.emit({ ...safeSignal, recipient: 'person@example.test' })).toThrow('invalid-command')
    expect(() =>
      signals.recordMetric({
        name: 'transactional-email.delivery-edge.events',
        dimensions: {
          environment: 'test',
          outcomeCode: 'provider-accepted',
          operationId: '42',
        },
      }),
    ).toThrow('invalid-command')
  })

  it.each([
    ['environment', 'tenant-prod'],
    ['outcomeCode', 'provider-private-detail'],
    ['outboxState', 'provider-state'],
    ['providerEventType', 'provider.private.event'],
    ['durationBucket', '52ms'],
    ['queueAgeBucket', 'address-derived'],
  ])('rejects an unbounded %s log value', (field, value) => {
    const signals = createDeliveryEdgeSignals({ log: vi.fn() })
    expect(() => signals.emit({ ...safeSignal, [field]: value })).toThrow('invalid-command')
  })

  it.each([
    ['environment', 'tenant-prod'],
    ['outcomeCode', 'provider-private-detail'],
    ['outboxState', 'provider-state'],
    ['providerEventType', 'provider.private.event'],
    ['durationBucket', '52ms'],
    ['queueAgeBucket', 'address-derived'],
  ])('rejects an unbounded %s metric dimension', (field, value) => {
    const signals = createDeliveryEdgeSignals({ log: vi.fn(), metric: vi.fn() })
    expect(() =>
      signals.recordMetric({
        name: 'transactional-email.delivery-edge.events',
        dimensions: { environment: 'test', outcomeCode: 'provider-accepted', [field]: value },
      }),
    ).toThrow('invalid-command')
  })

  it.each([
    [0, 'lt-1s'],
    [999, 'lt-1s'],
    [1_000, 'lt-5s'],
    [4_999, 'lt-5s'],
    [5_000, 'lt-20s'],
    [19_999, 'lt-20s'],
    [20_000, 'gte-20s'],
  ])('buckets attempt duration %i milliseconds as %s', (milliseconds, expected) => {
    expect(durationBucketFor(milliseconds)).toBe(expected)
  })

  it.each([
    [0, 'lt-1m'],
    [59_999, 'lt-1m'],
    [60_000, 'lt-5m'],
    [299_999, 'lt-5m'],
    [300_000, 'lt-30m'],
    [1_799_999, 'lt-30m'],
    [1_800_000, 'gte-30m'],
  ])('buckets queue age %i milliseconds as %s', (milliseconds, expected) => {
    expect(queueAgeBucketFor(milliseconds)).toBe(expected)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid bucket input %s', (milliseconds) => {
    expect(() => durationBucketFor(milliseconds)).toThrow('invalid-command')
    expect(() => queueAgeBucketFor(milliseconds)).toThrow('invalid-command')
  })

  it('isolates repository log and metric sink failures from signal emission', () => {
    const signals = createDeliveryEdgeSignals({
      log: () => {
        throw new Error('synthetic-log-failure')
      },
      metric: () => {
        throw new Error('synthetic-metric-failure')
      },
    })

    expect(() => signals.emit(safeSignal)).not.toThrow()
  })

  it('keeps the contract field sets explicit and small', () => {
    expect(deliveryEdgeLogFields).toEqual([
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
    ])
    expect(deliveryEdgeMetricDimensions).toEqual([
      'commandType',
      'environment',
      'outcomeCode',
      'outboxState',
      'providerEventType',
      'durationBucket',
      'queueAgeBucket',
    ])
  })
})
