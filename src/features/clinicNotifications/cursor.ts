import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { CLINIC_NOTIFICATIONS_CONTRACT_VERSION } from './contracts'
import { ClinicNotificationError } from './errors'

const scopeSchema = z
  .object({
    contractVersion: z.literal(CLINIC_NOTIFICATIONS_CONTRACT_VERSION),
    clinic: z.string().min(1).max(200),
    principal: z.string().min(1).max(200),
    view: z.enum(['unread', 'all']),
  })
  .strict()

const sortKeySchema = z
  .object({
    occurredAt: z.iso.datetime({ precision: 3 }),
    sourceOccurrenceId: z.string().min(1).max(200),
    notificationId: z.string().min(1).max(200),
    presentationId: z.string().min(1).max(200),
  })
  .strict()

const cursorSchema = scopeSchema.extend({ last: sortKeySchema }).strict()

export type NotificationSortKey = z.infer<typeof sortKeySchema>
export type NotificationCursorScope = z.infer<typeof scopeSchema>

function signature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update('clinic-notifications-v1:page:').update(payload).digest()
}

export function createNotificationCursor(
  scope: NotificationCursorScope,
  last: NotificationSortKey,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(cursorSchema.parse({ ...scope, last }))).toString('base64url')
  return `${payload}.${signature(payload, secret).toString('base64url')}`
}

export function readNotificationCursor(
  token: string,
  scope: NotificationCursorScope,
  secret: string,
): NotificationSortKey {
  try {
    const parts = token.split('.')
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/u.test(part)))
      throw new Error('Malformed cursor')
    const [payload, encodedSignature] = parts as [string, string]
    const candidate = Buffer.from(encodedSignature, 'base64url')
    const expected = signature(payload, secret)
    if (
      candidate.length !== expected.length ||
      candidate.toString('base64url') !== encodedSignature ||
      !timingSafeEqual(candidate, expected)
    )
      throw new Error('Invalid cursor signature')
    const bytes = Buffer.from(payload, 'base64url')
    if (bytes.toString('base64url') !== payload) throw new Error('Invalid cursor encoding')
    const parsed = cursorSchema.parse(JSON.parse(bytes.toString('utf8')))
    if (
      parsed.contractVersion !== scope.contractVersion ||
      parsed.clinic !== scope.clinic ||
      parsed.principal !== scope.principal ||
      parsed.view !== scope.view
    )
      throw new Error('Cursor belongs to another notification feed')
    return parsed.last
  } catch {
    throw new ClinicNotificationError('CURSOR_INVALID')
  }
}
