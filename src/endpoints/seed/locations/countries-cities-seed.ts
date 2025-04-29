import { Payload } from 'payload'
import { seedCollection } from '../seed-helpers'

/**
 * Seeds cities and countries with proper relationships
 */
export async function seedCountriesAndCities(payload: Payload): Promise<void> {
  payload.logger.info(`— Seeding cities and countries...`)

  // Step 1: Create countries
  const countries = [
    { name: 'Turkey', isoCode: 'TR', language: 'tr', currency: 'TRY' },
    { name: 'Germany', isoCode: 'DE', language: 'de', currency: 'EUR' },
  ]

  const countryDocs = await seedCollection(payload, 'countries', countries, async (countryData) => {
    return payload.create({
      collection: 'countries',
      data: {
        name: countryData.name,
        isoCode: countryData.isoCode,
        language: countryData.language,
        currency: countryData.currency,
      },
    })
  })

  // Step 2: Create cities with references to countries
  // Create a list of cities with their data
  const cities = [
    {
      name: 'Istanbul',
      countryName: 'Turkey',
      airportCode: 'IST',
      coordinates: [28.9784, 41.0082] as [number, number],
    },
    {
      name: 'Ankara',
      countryName: 'Turkey',
      airportCode: 'ESB',
      coordinates: [32.8597, 39.9334] as [number, number],
    },
  ]

  await seedCollection(payload, 'cities', cities, async (cityData) => {
    const country = countryDocs.find((country) => country.name === cityData.countryName)

    if (!country) {
      throw new Error(`Country not found for city ${cityData.name}`)
    }

    return payload.create({
      collection: 'cities',
      data: {
        name: cityData.name,
        country: country.id,
        airportcode: cityData.airportCode,
        coordinates: cityData.coordinates,
      },
    })
  })
}
