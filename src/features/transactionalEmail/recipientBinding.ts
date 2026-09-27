import { createHmac } from 'node:crypto'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import type { RecipientBinding } from './catalog'

export function recipientAddressDigest(address: string, key: { version: string; secret: string }) {
  const normalized = normalizeEmail(address)
  if (!isValidEmail(normalized)) return null
  return `${key.version}:${createHmac('sha256', key.secret).update(normalized, 'utf8').digest('hex')}`
}

export function recipientDigest(recipient: RecipientBinding) {
  return `fake-v1:${createHmac('sha256', 'synthetic-mail-binding-key')
    .update(JSON.stringify([recipient.binding, normalizeEmail(recipient.address)]))
    .digest('hex')}`
}
