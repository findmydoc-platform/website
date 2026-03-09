import { beforeEach, describe, test, expect, vi } from 'vitest'
import { POST } from '@/app/api/auth/register/clinic/route'

const findMock = vi.fn().mockResolvedValue({ docs: [] })
const createMock = vi.fn().mockResolvedValue({ id: 123 })
const loggerMock = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

// Mock payload getPayload import via dynamic module override if needed.
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()

  return {
    ...actual,
    // minimal buildConfig passthrough so importing payload.config doesn't explode
    buildConfig: (cfg: unknown) => cfg,
    getPayload: async () => ({
      find: findMock,
      create: createMock,
      logger: loggerMock,
    }),
  }
})

import { NextRequest } from 'next/server'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/register/clinic', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth/register/clinic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 400 and skips create for invalid zipCode', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: '12A45',
        city: 'Istanbul',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid zipCode')
    expect(createMock).not.toHaveBeenCalled()
  })

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
