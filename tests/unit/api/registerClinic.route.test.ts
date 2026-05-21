import { beforeEach, describe, test, expect, vi } from 'vitest'
import { POST } from '@/app/api/auth/register/clinic/route'

const turkeyCountry = { id: 1, name: 'Turkey', isoCode: 'TR' }
let cityDocs: Array<{ id: number; name: string; country: number }> = [{ id: 10, name: 'Istanbul', country: 1 }]

const findMock = vi.fn()
const createMock = vi.fn().mockResolvedValue({ id: 123 })
const loggerMock = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

const getWhereEquals = (where: unknown, key: string): unknown => {
  if (!where || typeof where !== 'object') {
    return undefined
  }

  const record = where as Record<string, unknown>
  const direct = record[key]
  if (direct && typeof direct === 'object' && 'equals' in direct) {
    return (direct as { equals?: unknown }).equals
  }

  const andConditions = record.and
  if (Array.isArray(andConditions)) {
    for (const condition of andConditions) {
      const match = getWhereEquals(condition, key)
      if (match !== undefined) {
        return match
      }
    }
  }

  return undefined
}

const mockPayloadFind = async ({ collection, where }: { collection?: string; where?: unknown }) => {
  if (collection === 'countries') {
    return { docs: [turkeyCountry] }
  }

  if (collection === 'cities') {
    const cityId = String(getWhereEquals(where, 'id') ?? '')
    const countryId = Number(getWhereEquals(where, 'country'))

    return {
      docs: cityDocs.filter((city) => String(city.id) === cityId && city.country === countryId),
    }
  }

  return { docs: [] }
}

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
    cityDocs = [{ id: 10, name: 'Istanbul', country: 1 }]
    findMock.mockImplementation(mockPayloadFind)
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

  test('creates application with an existing Turkey city id', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Should be replaced',
        cityId: '10',
        country: 'Turkey',
      }),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.id).toBeDefined()
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clinicApplications',
        data: expect.objectContaining({
          address: expect.objectContaining({
            city: 'Istanbul',
            country: 'Turkey',
          }),
        }),
      }),
    )
  })

  test('creates application with a custom Turkey city and default country', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Mersin',
      }),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          address: expect.objectContaining({
            city: 'Mersin',
            country: 'Turkey',
          }),
        }),
      }),
    )
  })

  test('rejects explicit non-Turkey country values', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Berlin',
        country: 'Germany',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('Clinic registrations are currently limited to Turkey')
    expect(createMock).not.toHaveBeenCalled()
  })

  test('rejects custom cities outside the Turkey allowlist', async () => {
    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        city: 'Berlin',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('Custom city must be a city in Turkey')
    expect(createMock).not.toHaveBeenCalled()
  })

  test('rejects invalid city ids', async () => {
    cityDocs = []

    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        cityId: '999',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('City is not available for Turkey')
    expect(createMock).not.toHaveBeenCalled()
  })

  test('rejects city ids outside Turkey', async () => {
    cityDocs = [{ id: 20, name: 'Berlin', country: 2 }]

    const res = await POST(
      makeRequest({
        clinicName: 'New Clinic',
        contactFirstName: 'A',
        contactLastName: 'B',
        contactEmail: 'test@example.com',
        street: 'Main',
        houseNumber: '1',
        zipCode: 12345,
        cityId: '20',
        country: 'Turkey',
      }),
    )

    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('City is not available for Turkey')
    expect(createMock).not.toHaveBeenCalled()
  })
})
