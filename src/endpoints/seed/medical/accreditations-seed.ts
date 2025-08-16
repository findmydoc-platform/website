import { Payload } from 'payload'
import { upsertByUniqueField, textToRichText } from '../seed-helpers'

/**
 * Seed healthcare accreditations idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedAccreditations(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding accreditations (idempotent)...')

  const accreditations = [
    {
      name: 'Joint Commission International',
      abbreviation: 'JCI',
      country: 'United States',
      description: textToRichText('Goldstandard für internationale Gesundheitsversorgung, Schwerpunkt auf Patientensicherheit und Qualitätsverbesserung'),
    },
  ]

  let created = 0
  let updated = 0

  for (const accreditation of accreditations) {
    const res = await upsertByUniqueField(payload, 'accreditation', 'name', accreditation)
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding accreditations.')
  return { created, updated }
}