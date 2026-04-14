import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'
import type { Doctor } from '@/payload-types'

describe('Doctor title integration', () => {
  let payload: Payload
  type PayloadCreateArgs = Parameters<Payload['create']>[0]
  let clinicId: number
  const slugPrefix = slugify(testSlug('doctors.titles.test.ts'))

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    // Ensure we have a clinic to link to
    const clinics = await payload.find({ collection: 'clinics', limit: 1 })
    if (clinics.docs.length > 0) {
      clinicId = clinics.docs[0]!.id
    } else {
      // 1. Ensure Country
      const countries = await payload.find({ collection: 'countries', limit: 1 })
      let countryId: number
      if (countries.docs.length > 0) {
        countryId = countries.docs[0]!.id
      } else {
        const country = await payload.create({
          collection: 'countries',
          data: {
            name: 'United States',
            isoCode: 'US',
            language: 'english',
            currency: 'USD',
          },
          overrideAccess: true,
          depth: 0,
        })
        countryId = country.id
      }

      // 2. Ensure City
      const cities = await payload.find({ collection: 'cities', limit: 1 })
      let cityId: number
      if (cities.docs.length > 0) {
        cityId = cities.docs[0]!.id
      } else {
        const city = await payload.create({
          collection: 'cities',
          data: {
            name: 'New York',
            country: countryId,
            coordinates: [40.7128, -74.006],
          },
          overrideAccess: true,
          depth: 0,
        })
        cityId = city.id
      }

      // 3. Create Clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          address: {
            country: 'Turkey',
            street: 'Main St',
            houseNumber: '1',
            zipCode: 12345,
            city: cityId,
          },
          contact: {
            phoneNumber: '+1234567890',
            email: 'contact@testclinic.com',
          },
          supportedLanguages: ['english'],
          status: 'approved',
          slug: `${slugPrefix}-fallback-clinic`,
        },
        overrideAccess: true,
        depth: 0,
      })
      clinicId = clinic.id
    }
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
  })

  it('generates fullName correctly for multi-word titles', async () => {
    const firstName = `${slugPrefix}-John`
    const lastName = 'Doe'

    // Test creation with "Prof. Dr."
    const doctor = (await payload.create({
      collection: 'doctors',
      data: {
        firstName,
        lastName,
        title: 'prof_dr',
        gender: 'male',
        // Required fields
        qualifications: ['MD'],
        languages: ['english'],
        clinic: clinicId,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Doctor

    const capFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
    expect(doctor.fullName).toBe(`Prof. Dr. ${capFirstName} ${lastName}`)
  })

  it('generates fullName correctly for simple titles', async () => {
    const firstName = `${slugPrefix}-Jane`
    const lastName = 'Smith'

    // Test creation with "Dr."
    const doctor = (await payload.create({
      collection: 'doctors',
      data: {
        firstName,
        lastName,
        title: 'dr',
        gender: 'female',
        // Required fields
        qualifications: ['MD'],
        languages: ['english'],
        clinic: clinicId,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Doctor

    const capFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
    expect(doctor.fullName).toBe(`Dr. ${capFirstName} ${lastName}`)
  })

  it('generates fullName correctly without title', async () => {
    const firstName = `${slugPrefix}-No`
    const lastName = 'Title'

    const doctor = (await payload.create({
      collection: 'doctors',
      data: {
        firstName,
        lastName,
        // No title
        gender: 'male',
        qualifications: ['MD'],
        languages: ['english'],
        clinic: clinicId,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Doctor
    const capFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
    expect(doctor.fullName).toBe(`${capFirstName} ${lastName}`)
  })
})
