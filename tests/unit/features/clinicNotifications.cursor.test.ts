import { describe, expect, it } from 'vitest'
import { createNotificationCursor, readNotificationCursor } from '@/features/clinicNotifications/cursor'

const scope = {
  contractVersion: 'clinic-notifications-v1',
  principal: 'reader-1',
  view: 'unread',
} as const
const key = {
  occurredAt: '2026-10-14T09:00:00.000Z',
  sourceOccurrenceId: 'source-2',
  notificationId: 'notification-2',
  presentationId: 'presentation-2',
}

describe('notification continuation cursor', () => {
  it('round trips the complete sort key without exposing it as plain JSON', () => {
    const cursor = createNotificationCursor(scope, key, 'test-secret')
    expect(cursor).not.toContain('notification-2')
    expect(readNotificationCursor(cursor, scope, 'test-secret')).toEqual(key)
  })

  it.each([
    { ...scope, principal: 'reader-2' },
    { ...scope, view: 'all' as const },
  ])('rejects a cursor outside its feed scope', (otherScope) => {
    const cursor = createNotificationCursor(scope, key, 'test-secret')
    expect(() => readNotificationCursor(cursor, otherScope, 'test-secret')).toThrowError(
      expect.objectContaining({ code: 'CURSOR_INVALID' }),
    )
  })

  it('rejects tampering, an invalid signature and a different signing key', () => {
    const cursor = createNotificationCursor(scope, key, 'test-secret')
    const [payload, signature] = cursor.split('.')
    const changed = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')),
        last: { ...key, notificationId: 'changed' },
      }),
    ).toString('base64url')
    for (const candidate of [`${changed}.${signature}`, `${payload}.bad`, cursor])
      expect(() =>
        readNotificationCursor(candidate, scope, candidate === cursor ? 'other-secret' : 'test-secret'),
      ).toThrowError(expect.objectContaining({ code: 'CURSOR_INVALID' }))
  })
})
