import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { clinicGroupMembershipEndpoint } from '@/features/clinicGroups/membership'

describe('Clinic group membership endpoint', () => {
  it('preserves private response headers when native validation rejects the command', async () => {
    const req = {
      routeParams: { id: 'not-a-clinic' },
      json: async () => ({ fromGroupId: 1, toGroupId: 2 }),
      responseHeaders: new Headers({ 'X-Request-ID': 'membership-request' }),
    } as unknown as PayloadRequest

    await expect(clinicGroupMembershipEndpoint.handler(req)).rejects.toMatchObject({ status: 400 })

    // Payload applies these request-owned response headers when serializing a thrown APIError.
    expect(req.responseHeaders?.get('Cache-Control')).toBe('private, no-store')
    expect(req.responseHeaders?.get('Vary')).toBe('Authorization, Cookie')
    expect(req.responseHeaders?.get('X-Request-ID')).toBe('membership-request')
  })
})
