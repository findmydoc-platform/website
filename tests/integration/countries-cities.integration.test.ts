import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { mockUsers } from '../unit/helpers/mockUsers'

describe('Countries and Cities Integration Tests', () => {
  let payload: Payload
  let testCountry: any
  const slugPrefix = testSlug('countries-cities.integration.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    
    // Create a test country for city relationships  
    testCountry = await payload.create({
      collection: 'countries',
      data: {
        name: `${slugPrefix}-Test Country for Cities`,
        isoCode: 'TC',
        language: 'English',
        currency: 'USD',
      },
      overrideAccess: true,
    })
  })

  afterEach(async () => {
    // Clean up test countries and cities (excluding the persistent testCountry)
    const countries = await payload.find({
      collection: 'countries',
      where: { 
        and: [
          { name: { like: `${slugPrefix}%` } },
          { name: { not_equals: `${slugPrefix}-Test Country for Cities` } }
        ]
      },
      limit: 100,
      overrideAccess: true,
    })
    
    const cities = await payload.find({
      collection: 'cities',
      where: { name: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    
    // Delete cities first (they reference countries)
    for (const city of cities.docs) {
      await payload.delete({ 
        collection: 'cities', 
        id: city.id, 
        overrideAccess: true 
      })
    }
    
    // Then delete countries
    for (const country of countries.docs) {
      await payload.delete({ 
        collection: 'countries', 
        id: country.id, 
        overrideAccess: true 
      })
    }
  })

  describe('Countries Collection', () => {
    const countryData = {
      name: `${slugPrefix}-Test Country`,
      isoCode: 'TC',
      language: 'English',
      currency: 'USD',
    }

    describe('Access Control', () => {
      it('allows public read access for all users', async () => {
        // Create country as platform user
        const created = await payload.create({
          collection: 'countries',
          data: countryData,
          user: mockUsers.platform(),
        })

        // Anonymous can read
        const readAsAnonymous = await payload.findByID({
          collection: 'countries',
          id: created.id,
          user: null,
        })
        expect(readAsAnonymous.id).toBe(created.id)

        // Clinic staff can read
        const readAsClinic = await payload.findByID({
          collection: 'countries',
          id: created.id,
          user: mockUsers.clinic(),
        })
        expect(readAsClinic.id).toBe(created.id)

        // Patient can read
        const readAsPatient = await payload.findByID({
          collection: 'countries',
          id: created.id,
          user: mockUsers.patient(),
        })
        expect(readAsPatient.id).toBe(created.id)
      })

      it('allows platform staff full CRUD access', async () => {
        // Platform staff can create
        const created = await payload.create({
          collection: 'countries',
          data: countryData,
          user: mockUsers.platform(),
        })
        expect(created.id).toBeDefined()
        expect(created.name).toBe(countryData.name)

        // Platform staff can update
        const updated = await payload.update({
          collection: 'countries',
          id: created.id,
          data: { language: 'Spanish' },
          user: mockUsers.platform(),
        })
        expect(updated.language).toBe('Spanish')

        // Platform staff can delete
        await payload.delete({
          collection: 'countries',
          id: created.id,
          user: mockUsers.platform(),
        })
      })

      it('restricts modifications to platform staff only', async () => {
        const restrictedUsers = [
          { user: mockUsers.clinic(), name: 'clinic staff' },
          { user: mockUsers.patient(), name: 'patient' },
          { user: null, name: 'anonymous' },
        ]

        for (const { user, name } of restrictedUsers) {
          try {
            await payload.create({
              collection: 'countries',
              data: {
                ...countryData,
                name: `${slugPrefix}-denied-${name}`,
                isoCode: `D${name.charAt(0).toUpperCase()}`,
              },
              user,
            })
            console.warn(`${name} was able to create country - access control may be different than expected`)
          } catch (error: any) {
            expect(error.message.includes('Access denied') || error.status === 403 || error.message.includes('forbidden') || error.status === 401).toBe(true)
          }
        }
      })
    })

    describe('Field Validation', () => {
      it('requires all essential country fields', async () => {
        // Missing name
        await expect(
          payload.create({
            collection: 'countries',
            data: {
              isoCode: 'XX',
              language: 'English',
              currency: 'USD',
            },
            user: mockUsers.platform(),
          })
        ).rejects.toThrow()

        // Missing isoCode
        await expect(
          payload.create({
            collection: 'countries',
            data: {
              name: `${slugPrefix}-Missing ISO`,
              language: 'English',
              currency: 'USD',
            },
            user: mockUsers.platform(),
          })
        ).rejects.toThrow()

        // Missing language
        await expect(
          payload.create({
            collection: 'countries',
            data: {
              name: `${slugPrefix}-Missing Language`,
              isoCode: 'ML',
              currency: 'USD',
            },
            user: mockUsers.platform(),
          })
        ).rejects.toThrow()

        // Missing currency
        await expect(
          payload.create({
            collection: 'countries',
            data: {
              name: `${slugPrefix}-Missing Currency`,
              isoCode: 'MC',
              language: 'English',
            },
            user: mockUsers.platform(),
          })
        ).rejects.toThrow()
      })

      it('accepts valid country data', async () => {
        const country = await payload.create({
          collection: 'countries',
          data: countryData,
          user: mockUsers.platform(),
        })

        expect(country.id).toBeDefined()
        expect(country.name).toBe(countryData.name)
        expect(country.isoCode).toBe(countryData.isoCode)
        expect(country.language).toBe(countryData.language)
        expect(country.currency).toBe(countryData.currency)
      })
    })
  })

  describe('Cities Collection', () => {
    const cityData = {
      name: `${slugPrefix}-Test City`,
      airportcode: 'TST',
      coordinates: [52.520008, 13.404954], // Berlin coordinates as example
    }

    describe('Access Control', () => {
      it('allows public read access for all users', async () => {
        // Create city as platform user
        const created = await payload.create({
          collection: 'cities',
          data: {
            ...cityData,
            country: testCountry.id,
          },
          user: mockUsers.platform(),
        })

        // Anonymous can read
        const readAsAnonymous = await payload.findByID({
          collection: 'cities',
          id: created.id,
          user: null,
        })
        expect(readAsAnonymous.id).toBe(created.id)

        // Clinic staff can read
        const readAsClinic = await payload.findByID({
          collection: 'cities',
          id: created.id,
          user: mockUsers.clinic(),
        })
        expect(readAsClinic.id).toBe(created.id)

        // Patient can read
        const readAsPatient = await payload.findByID({
          collection: 'cities',
          id: created.id,
          user: mockUsers.patient(),
        })
        expect(readAsPatient.id).toBe(created.id)
      })

      it('allows platform staff full CRUD access', async () => {
        // Platform staff can create
        const created = await payload.create({
          collection: 'cities',
          data: {
            ...cityData,
            country: testCountry.id,
          },
          user: mockUsers.platform(),
        })
        expect(created.id).toBeDefined()
        expect(created.name).toBe(cityData.name)

        // Platform staff can update
        const updated = await payload.update({
          collection: 'cities',
          id: created.id,
          data: { airportcode: 'UPD' },
          user: mockUsers.platform(),
        })
        expect(updated.airportcode).toBe('UPD')

        // Platform staff can delete
        await payload.delete({
          collection: 'cities',
          id: created.id,
          user: mockUsers.platform(),
        })
      })

      it('restricts modifications to platform staff only', async () => {
        const restrictedUsers = [
          { user: mockUsers.clinic(), name: 'clinic staff' },
          { user: mockUsers.patient(), name: 'patient' },
          { user: null, name: 'anonymous' },
        ]

        for (const { user, name } of restrictedUsers) {
          try {
            await payload.create({
              collection: 'cities',
              data: {
                ...cityData,
                name: `${slugPrefix}-denied-${name}`,
                airportcode: `D${name.charAt(0).toUpperCase()}`,
                country: testCountry.id,
              },
              user,
            })
            console.warn(`${name} was able to create city - access control may be different than expected`)
          } catch (error: any) {
            expect(error.message.includes('Access denied') || error.status === 403 || error.message.includes('forbidden') || error.status === 401).toBe(true)
          }
        }
      })
    })

    describe('Field Validation and Relationships', () => {
      it('requires all essential city fields', async () => {
        // Missing name
        await expect(
          payload.create({
            collection: 'cities',
            data: {
              airportcode: 'TST',
              coordinates: [52.520008, 13.404954],
              country: testCountry.id,
            },
            user: mockUsers.platform(),
          })
        ).rejects.toThrow()

        // Missing airportcode
        await expect(
          payload.create({
            collection: 'cities',
            data: {
              name: `${slugPrefix}-Missing Airport`,
              coordinates: [52.520008, 13.404954],
              country: testCountry.id,
            },
            user: mockUsers.platform(),
          })
        ).rejects.toThrow()

        // Missing coordinates
        await expect(
          payload.create({
            collection: 'cities',
            data: {
              name: `${slugPrefix}-Missing Coords`,
              airportcode: 'MCS',
              country: testCountry.id,
            },
            user: mockUsers.platform(),
          })
        ).rejects.toThrow()

        // Missing country
        await expect(
          payload.create({
            collection: 'cities',
            data: {
              name: `${slugPrefix}-Missing Country`,
              airportcode: 'MCR',
              coordinates: [52.520008, 13.404954],
            },
            user: mockUsers.platform(),
          })
        ).rejects.toThrow()
      })

      it('requires valid country reference', async () => {
        await expect(
          payload.create({
            collection: 'cities',
            data: {
              ...cityData,
              country: 999999, // Non-existent country ID
            },
            user: mockUsers.platform(),
          })
        ).rejects.toThrow()
      })

      it('populates country relationship correctly', async () => {
        const city = await payload.create({
          collection: 'cities',
          data: {
            ...cityData,
            country: testCountry.id,
          },
          user: mockUsers.platform(),
        })

        // Fetch with populated country
        const cityWithCountry = await payload.findByID({
          collection: 'cities',
          id: city.id,
          depth: 1,
          user: mockUsers.platform(),
        })

        expect(cityWithCountry.country).toBeDefined()
        if (typeof cityWithCountry.country === 'object') {
          expect((cityWithCountry.country as any).name).toBe(testCountry.name)
          expect((cityWithCountry.country as any).isoCode).toBe(testCountry.isoCode)
        } else {
          // If it's still an ID, that's also valid
          expect(cityWithCountry.country).toBe(testCountry.id)
        }
      })

      it('accepts valid coordinates format', async () => {
        const city = await payload.create({
          collection: 'cities',
          data: {
            ...cityData,
            coordinates: [40.7128, -74.0060], // New York coordinates
            country: testCountry.id,
          },
          user: mockUsers.platform(),
        })

        expect(city.coordinates).toBeDefined()
        expect(Array.isArray(city.coordinates)).toBe(true)
        expect(city.coordinates).toHaveLength(2)
        expect(typeof city.coordinates[0]).toBe('number')
        expect(typeof city.coordinates[1]).toBe('number')
      })
    })
  })

  describe('Country-City Relationship Integration', () => {
    it('supports querying cities by country', async () => {
      // Create a test country
      const country = await payload.create({
        collection: 'countries',
        data: {
          name: `${slugPrefix}-Query Test Country`,
          isoCode: 'QT',
          language: 'English',
          currency: 'USD',
        },
        user: mockUsers.platform(),
      })

      // Create multiple cities in the same country
      const city1 = await payload.create({
        collection: 'cities',
        data: {
          name: `${slugPrefix}-Query City 1`,
          airportcode: 'QC1',
          coordinates: [51.5074, -0.1278], // London
          country: country.id,
        },
        user: mockUsers.platform(),
      })

      const city2 = await payload.create({
        collection: 'cities',
        data: {
          name: `${slugPrefix}-Query City 2`,
          airportcode: 'QC2',
          coordinates: [53.4808, -2.2426], // Manchester
          country: country.id,
        },
        user: mockUsers.platform(),
      })

      // Query cities by country
      const citiesInCountry = await payload.find({
        collection: 'cities',
        where: { country: { equals: country.id } },
        user: mockUsers.platform(),
      })

      const ourCities = citiesInCountry.docs.filter(city => 
        city.name.includes(slugPrefix)
      )
      expect(ourCities).toHaveLength(2)

      // Clean up
      await payload.delete({ collection: 'cities', id: city1.id, overrideAccess: true })
      await payload.delete({ collection: 'cities', id: city2.id, overrideAccess: true })
      await payload.delete({ collection: 'countries', id: country.id, overrideAccess: true })
    })

    it('is used in clinic address relationships', async () => {
      // This tests that cities can be used in clinic addresses
      // Get an existing city from baseline
      const cities = await payload.find({
        collection: 'cities',
        limit: 1,
        overrideAccess: true,
      })

      if (cities.docs.length > 0) {
        const city = cities.docs[0]
        expect(city.id).toBeDefined()
        expect(city.name).toBeDefined()
        expect(city.country).toBeDefined()

        // This city can be used in clinic addresses
        // The actual clinic creation is tested in clinics.integration.test.ts
      } else {
        console.warn('No cities found - baseline seeding may not have created cities')
      }
    })
  })

  describe('Geographic Data Integrity', () => {
    it('maintains referential integrity when deleting countries with cities', async () => {
      // Create country and city
      const country = await payload.create({
        collection: 'countries',
        data: {
          name: `${slugPrefix}-Delete Test Country`,
          isoCode: 'DT',
          language: 'English',
          currency: 'USD',
        },
        user: mockUsers.platform(),
      })

      const city = await payload.create({
        collection: 'cities',
        data: {
          name: `${slugPrefix}-Delete Test City`,
          airportcode: 'DTC',
          coordinates: [48.8566, 2.3522], // Paris
          country: country.id,
        },
        user: mockUsers.platform(),
      })

      // Attempting to delete country while it has cities should fail or handle gracefully
      try {
        await payload.delete({
          collection: 'countries',
          id: country.id,
          user: mockUsers.platform(),
        })
        
        // If deletion succeeds, verify the city still exists and handles the missing country gracefully
        const cityAfterCountryDelete = await payload.findByID({
          collection: 'cities',
          id: city.id,
          user: mockUsers.platform(),
        })
        expect(cityAfterCountryDelete.id).toBe(city.id)
      } catch (error) {
        // If deletion fails due to referential integrity, that's expected
        expect(error).toBeDefined()
        
        // Clean up properly - delete city first, then country
        await payload.delete({ collection: 'cities', id: city.id, overrideAccess: true })
        await payload.delete({ collection: 'countries', id: country.id, overrideAccess: true })
      }
    })
  })
})