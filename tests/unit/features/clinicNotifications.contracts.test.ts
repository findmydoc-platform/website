import { describe, expect, it } from 'vitest'
import cases from '../../fixtures/clinic-notifications-v1.json'
import readCases from '../../fixtures/clinic-notification-read-v1.json'
import {
  notificationsResponseSchema,
  notificationErrorSchema,
  notificationReadSuccessSchema,
} from '@/features/clinicNotifications/contracts'

describe('Website clinic-notifications-v1 published wire contract', () => {
  it.each(readCases)('accepts independent acknowledgement case $name without discarding fields', ({ response }) => {
    const schema = 'acknowledged' in response ? notificationReadSuccessSchema : notificationErrorSchema
    expect(schema.parse(response)).toEqual(response)
  })
  it.each(cases)('accepts the independent $name wire example without discarding fields', ({ response }) => {
    expect(notificationsResponseSchema.parse(response)).toEqual(response)
  })

  it('rejects unknown occurrence versions, events and arbitrary fields as a complete response', () => {
    const example = cases[0]!.response
    for (const changes of [
      { schemaVersion: 2 },
      { eventType: 'internal_status_update' },
      { messageBody: 'Forbidden content' },
    ]) {
      const response = structuredClone(example)
      Object.assign(response.items![0]!.members[0]!, changes)
      expect(notificationsResponseSchema.safeParse(response).success).toBe(false)
    }
  })

  it('rejects a destination that substitutes a different source record', () => {
    const response = structuredClone(cases[0]!.response)
    const destination = response.items![0]!.destination
    if (!('inquiryId' in destination)) throw new Error('Expected the independent inquiry example')
    destination.inquiryId = 'different-record'
    expect(notificationsResponseSchema.safeParse(response).success).toBe(false)
  })

  it('validates explicit acknowledgement outcomes without inferring rollback from HTTP', () => {
    expect(
      notificationReadSuccessSchema.parse({
        contractVersion: 'clinic-notifications-v1',
        serverTime: '2026-10-14T09:00:01.000Z',
        acknowledged: true,
      }),
    ).toMatchObject({ acknowledged: true })
    expect(
      notificationErrorSchema.parse({
        contractVersion: 'clinic-notifications-v1',
        error: { code: 'SERVICE_TIMEOUT' },
        writeOutcome: 'unknown',
      }),
    ).toMatchObject({ writeOutcome: 'unknown' })
    expect(
      notificationErrorSchema.safeParse({
        contractVersion: 'clinic-notifications-v1',
        error: { code: 'DATABASE_FAILURE', rawBody: 'Forbidden' },
      }).success,
    ).toBe(false)
  })
})
