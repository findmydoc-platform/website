import { Payload } from 'payload'
import { upsertByUniqueField } from '../seed-helpers'

/**
 * Generate slug from title (simple implementation for seeding).
 * @param title The title to convert to a slug
 * @returns URL-friendly slug
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Seed generic blog categories idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedCategories(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding categories (idempotent)...')

  const categories = [
    { title: 'Health & Wellness', slug: generateSlug('Health & Wellness') },
    { title: 'Medical Tourism', slug: generateSlug('Medical Tourism') },
    { title: 'Clinic Reviews', slug: generateSlug('Clinic Reviews') },
  ]

  let created = 0
  let updated = 0

  for (const category of categories) {
    const res = await upsertByUniqueField(payload, 'categories', 'title', category)
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding categories.')
  return { created, updated }
}