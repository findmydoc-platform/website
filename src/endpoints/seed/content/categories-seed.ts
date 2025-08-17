import { Payload } from 'payload'
import { upsertByUniqueField } from '../seed-helpers'
import { slugify } from '@/utilities/slugify'

/**
 * Seed generic blog categories idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedCategories(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding categories (idempotent)...')

  const categories = [
    { title: 'Health & Wellness', slug: slugify('Health & Wellness') },
    { title: 'Medical Tourism', slug: slugify('Medical Tourism') },
    { title: 'Clinic Reviews', slug: slugify('Clinic Reviews') },
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