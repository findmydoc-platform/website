import { Payload } from 'payload'
import { upsertByUniqueField } from '../seed-helpers'
import { slugify } from '@/utilities/slugify'

/**
 * Seed starter tags idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedTags(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding tags (idempotent)...')

  const tags = [
    { name: 'Safety', slug: slugify('Safety') },
    { name: 'Recovery', slug: slugify('Recovery') },
    { name: 'Costs', slug: slugify('Costs') },
    { name: 'Technology', slug: slugify('Technology') },
    { name: 'Accreditation', slug: slugify('Accreditation') },
  ]

  let created = 0
  let updated = 0

  for (const tag of tags) {
    const res = await upsertByUniqueField(payload, 'tags', 'name', tag)
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding tags.')
  return { created, updated }
}