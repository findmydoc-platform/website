import { Payload } from 'payload'
import { upsertByUniqueField } from '../seed-helpers'

/**
 * Seed hierarchical medical specialties (parents then children) idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedMedicalSpecialties(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding medical specialties (idempotent)...')

  const parents = [
    { name: 'Internal Medicine', description: 'General internal medicine and subspecialties.' },
    { name: 'Surgery', description: 'All surgical specialties.' },
    { name: 'Pediatrics', description: 'Child health.' },
    { name: 'Dentistry', description: 'Dental and oral health.' },
  ]

  let created = 0
  let updated = 0
  const parentMap: Record<string, any> = {}

  for (const p of parents) {
    const res = await upsertByUniqueField(payload, 'medical-specialties', 'name', p)
    if (res.created) created++
    if (res.updated) updated++
    parentMap[p.name] = res.doc
  }

  const children = [
    { name: 'Cardiology', description: 'Heart and blood vessel specialists.', parent: 'Internal Medicine' },
    { name: 'Neurology', description: 'Nervous system disorders.', parent: 'Internal Medicine' },
    { name: 'Dermatology', description: 'Skin and related diseases.', parent: 'Internal Medicine' },
    { name: 'Orthopedics', description: 'Bones and joints.', parent: 'Surgery' },
    { name: 'General Surgery', description: 'Surgical procedures.', parent: 'Surgery' },
  ]

  for (const c of children) {
    const parent = parentMap[c.parent]
    const res = await upsertByUniqueField(payload, 'medical-specialties', 'name', {
      name: c.name,
      description: c.description,
      parentSpecialty: parent?.id,
    })
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding medical specialties.')
  return { created, updated }
}
