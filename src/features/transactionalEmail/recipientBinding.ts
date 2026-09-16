import { createHmac } from 'node:crypto'
import type { RecipientBinding } from './catalog'

export function recipientDigest(recipient: RecipientBinding) {
  return `fake-v1:${createHmac('sha256', 'synthetic-mail-binding-key')
    .update(JSON.stringify([recipient.binding, recipient.address]))
    .digest('hex')}`
}
