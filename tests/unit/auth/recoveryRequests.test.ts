import { afterEach, describe, expect, it, vi } from 'vitest'
import { websiteRecoveryContext, dashboardRecoveryContext } from '@/auth/actions/recoveryContext'
import { createHash, createHmac } from 'node:crypto'

afterEach(() => vi.unstubAllEnvs())

describe('recovery request client authentication', () => {
  it('accepts the deployment IP only on Vercel and rejects arbitrary forwarded headers', () => {
    const request = new Request('https://example.test/auth', {
      headers: { 'x-forwarded-for': '203.0.113.5', 'x-vercel-forwarded-for': '198.51.100.8' },
    })
    expect(websiteRecoveryContext(request)).toBeNull()
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(websiteRecoveryContext(request)).not.toBeNull()
    expect(
      websiteRecoveryContext(new Request(request.url, { headers: { 'x-forwarded-for': '203.0.113.5' } })),
    ).toBeNull()
    expect(
      websiteRecoveryContext(
        new Request(request.url, { headers: { 'x-vercel-forwarded-for': '198.51.100.8, 203.0.113.5' } }),
      ),
    ).toBeNull()
  })

  it('binds the Dashboard client IP to the authenticated body and environment', () => {
    const secret = 'synthetic-dashboard-signing-material-for-tests'
    const now = Date.parse('2026-10-02T10:00:00Z')
    const body = JSON.stringify({ email: 'patient@example.test', clientIP: '198.51.100.8' })
    const envelope = {
      method: 'POST',
      operation: 'requestRecovery',
      timestamp: new Date(now).toISOString(),
      requestId: '147b07f0-7623-4e46-a657-6e25096d4991',
      body,
      keyVersion: 'v1',
      signature: '',
    }
    envelope.signature = createHmac('sha256', secret)
      .update(
        JSON.stringify([
          'auth-recovery-request-v1',
          'preview',
          envelope.method,
          envelope.operation,
          envelope.timestamp,
          envelope.requestId,
          createHash('sha256').update(body).digest('hex'),
        ]),
      )
      .digest('hex')
    const options = { environment: 'preview' as const, keys: [{ version: 'v1', secret }], now: () => now }
    expect(dashboardRecoveryContext(envelope, options)).not.toBeNull()
    expect(dashboardRecoveryContext({ ...envelope, body: body.replace('100.8', '100.9') }, options)).toBeNull()
    expect(dashboardRecoveryContext(envelope, { ...options, environment: 'production' })).toBeNull()
    expect(dashboardRecoveryContext(envelope, { ...options, now: () => now + 300000 })).toBeNull()
  })
})
