import { Payload } from 'payload'
import { upsertByUniqueField } from '../seed-helpers'

/**
 * Generate slug from name (simple implementation for seeding).
 * @param name The name to convert to a slug
 * @returns URL-friendly slug
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Seed starter tags idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedTags(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding tags (idempotent)...')

  const tags = [
    { name: 'Safety', slug: generateSlug('Safety') },
    { name: 'Recovery', slug: generateSlug('Recovery') },
    { name: 'Costs', slug: generateSlug('Costs') },
    { name: 'Technology', slug: generateSlug('Technology') },
    { name: 'Accreditation', slug: generateSlug('Accreditation') },
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