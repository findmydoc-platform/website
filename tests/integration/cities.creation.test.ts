/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

describe('Cities Integration Tests (Clinic Dependency)', () => {
  let payload: Payload
  const slugPrefix = testSlug('cities.creation.test.ts')
  let countryId: number

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    // Get baseline country for city creation
    const countryRes = await payload.find({ collection: 'countries', limit: 1, overrideAccess: true, depth: 0 })
    const countryDoc = countryRes.docs[0]
    if (!countryDoc) throw new Error('Expected baseline country for city creation tests')
    countryId = countryDoc.id as number
  }, 60000)

  afterEach(async () => {
    await cleanupTestEntities(payload, 'cities', slugPrefix)
  })

  it('creates a city with all required fields', async () => {
    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-test-city`,
        airportcode: 'TST',
        coordinates: [41.0082, 28.9784],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(city.id).toBeDefined()
    expect(city.name).toBe(`${slugPrefix}-test-city`)
    expect(city.airportcode).toBe('TST')
    expect(city.coordinates).toEqual([41.0082, 28.9784])
    expect(city.country).toBe(countryId)
  })

  it('creates a city without airport code (optional field)', async () => {
    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-no-airport`,
        coordinates: [39.9334, 32.8597],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(city.id).toBeDefined()
    expect(city.name).toBe(`${slugPrefix}-no-airport`)
    expect(city.airportcode ?? null).toBeNull()
    expect(city.coordinates).toEqual([39.9334, 32.8597])
  })

  it('validates required fields when creating a city', async () => {
    await expect(
      payload.create({
        collection: 'cities',
        data: {
          name: `${slugPrefix}-invalid-city`,
          // Missing required coordinates and country
        } as any,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('validates coordinates format', async () => {
    await expect(
      payload.create({
        collection: 'cities',
        data: {
          name: `${slugPrefix}-invalid-coords`,
          coordinates: 'invalid' as any, // Invalid coordinates format
          country: countryId,
        },
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('updates city information', async () => {
    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-update-city`,
        coordinates: [40.0, 30.0],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    const updatedCity = await payload.update({
      collection: 'cities',
      id: city.id,
      data: {
        name: `${slugPrefix}-updated-city`,
        airportcode: 'UPD',
        coordinates: [40.5, 30.5],
      },
      overrideAccess: true,
      depth: 0,
    })

    const refreshedCity = await payload.findByID({
      collection: 'cities',
      id: city.id,
      overrideAccess: true,
      depth: 0,
    })

    expect(updatedCity.id).toBe(city.id)
    expect(updatedCity.name).toBe(`${slugPrefix}-updated-city`)
    expect(updatedCity.airportcode).toBe('UPD')
    expect(refreshedCity.coordinates).toEqual([40.5, 30.5])
  })

  it('allows anyone to read cities (public access)', async () => {
    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-public-city`,
        coordinates: [41.0, 29.0],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    // Query without overrideAccess to test public read access
    const result = await payload.find({
      collection: 'cities',
      where: { id: { equals: city.id } },
      depth: 0,
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0]?.name).toBe(`${slugPrefix}-public-city`)
  })

  it('creates multiple cities with different airport codes', async () => {
    const city1 = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-city-1`,
        airportcode: 'CT1',
        coordinates: [41.0, 28.0],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    const city2 = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-city-2`,
        airportcode: 'CT2',
        coordinates: [42.0, 29.0],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(city1.id).toBeDefined()
    expect(city2.id).toBeDefined()
    expect(city1.airportcode).toBe('CT1')
    expect(city2.airportcode).toBe('CT2')
  })
})
