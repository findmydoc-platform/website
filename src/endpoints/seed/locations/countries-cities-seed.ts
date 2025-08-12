import { Payload } from 'payload'
import { upsertByUniqueField } from '../seed-helpers'

/**
 * Seed countries then cities referencing them (idempotent upserts).
 * @param payload Payload instance
 */
export async function seedCountriesAndCities(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding countries and cities (idempotent)...')

  let created = 0
  let updated = 0

  const countries = [
    { name: 'Turkey', isoCode: 'TR', language: 'tr', currency: 'TRY' },
    { name: 'Germany', isoCode: 'DE', language: 'de', currency: 'EUR' },
  ]

  const countryMap: Record<string, any> = {}
  for (const c of countries) {
    const res = await upsertByUniqueField(payload, 'countries', 'name', c)
    if (res.created) created++
    if (res.updated) updated++
    countryMap[c.name] = res.doc
  }

  const cities = [
    {
      name: 'Istanbul',
      countryName: 'Turkey',
      airportcode: 'IST',
      coordinates: [28.9784, 41.0082] as [number, number],
    },
    { name: 'Ankara', countryName: 'Turkey', airportcode: 'ESB', coordinates: [32.8597, 39.9334] as [number, number] },
    { name: 'Izmir', countryName: 'Turkey', airportcode: 'ADB', coordinates: [27.1428, 38.4237] as [number, number] },
  ]
  for (const city of cities) {
    const country = countryMap[city.countryName]
    if (!country) continue
    const res = await upsertByUniqueField(payload, 'cities', 'name', {
      name: city.name,
      country: country.id,
      airportcode: city.airportcode,
      coordinates: city.coordinates,
    })
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding countries and cities.')
  return { created, updated }
}
