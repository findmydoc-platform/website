import { describe, test, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/register/clinic/route'
import { ReadableStream } from 'node:stream/web'

// Mock payload getPayload import via dynamic module override if needed.
vi.mock('payload', () => ({
  // minimal buildConfig passthrough so importing payload.config doesn't explode
  buildConfig: (cfg: any) => cfg,
  getPayload: async () => ({
    find: vi.fn().mockResolvedValue({ docs: [] }),
    create: vi.fn().mockResolvedValue({ id: 123 }),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  }),
}))

function makeRequest(body: any) {
  return new Request('http://localhost/api/register/clinic', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('POST /api/register/clinic', () => {
  test('creates application success', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Istanbul',
        country: 'Turkey',
      }),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.id).toBeDefined()
  })
})
