import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  authenticateAuthActionRequest,
  createActionReference,
  readActionReference,
  type AuthActionProtocolKeys,
} from '@/auth/actions/protocol/credentials'

const now = Date.parse('2026-10-04T12:00:00.000Z')
const serviceKey = randomBytes(32).toString('hex')
const referenceKey = randomBytes(32).toString('hex')
const keys: AuthActionProtocolKeys = {
  environment: 'test',
  service: [{ version: 'current', secret: serviceKey }],
  reference: [{ version: 'current', secret: referenceKey }],
}

function envelope(body = JSON.stringify({ email: 'synthetic@example.invalid', clientIP: '192.0.2.10' })) {
  const input = {
    method: 'POST',
    operation: 'requestRecovery',
    timestamp: new Date(now).toISOString(),
    requestId: randomUUID(),
    keyVersion: 'current',
    body,
    signature: '',
  }
  input.signature = createHmac('sha256', serviceKey)
    .update(
      JSON.stringify([
        'auth-action-protocol-v1',
        'test',
        input.method,
        input.operation,
        input.timestamp,
        input.requestId,
        createHash('sha256').update(input.body).digest('hex'),
      ]),
    )
    .digest('hex')
  return input
}

describe('Website auth-action protocol credentials', () => {
  it('authenticates a bounded Dashboard request without exposing its credentials', () => {
    const input = envelope()
    const authenticated = authenticateAuthActionRequest(input, keys, now)
    expect(authenticated).toEqual({ requestId: input.requestId, expiresAt: now + 300_000 })
  })

  it.each(['method', 'operation', 'timestamp', 'requestId', 'body', 'keyVersion', 'signature'] as const)(
    'rejects a changed %s before granting service authority',
    (field) => {
      const input = envelope()
      input[field] += 'tampered'
      expect(authenticateAuthActionRequest(input, keys, now)).toBeNull()
    },
  )

  it('rejects stale, future and cross-environment envelopes', () => {
    const input = envelope()
    expect(authenticateAuthActionRequest(input, keys, now + 300_000)).toBeNull()
    expect(authenticateAuthActionRequest(input, keys, now - 1)).toBeNull()
    expect(authenticateAuthActionRequest(input, { ...keys, environment: 'preview' }, now)).toBeNull()
  })

  it('binds Website references to the immutable action, flow, environment and version', () => {
    const reference = createActionReference({ actionId: 42, flow: 'clinic-recovery' }, keys)
    expect(readActionReference(reference, keys)).toEqual({
      version: 1,
      actionId: 42,
      flow: 'clinic-recovery',
      environment: 'test',
    })
    expect(readActionReference(reference + 'x', keys)).toBeNull()
    expect(readActionReference(reference, { ...keys, environment: 'production' })).toBeNull()
  })

  it('does not let a Dashboard service key manufacture a Website action reference', () => {
    const forged = createActionReference(
      { actionId: 42, flow: 'clinic-invitation' },
      { ...keys, reference: keys.service },
    )
    expect(readActionReference(forged, keys)).toBeNull()
  })
})
