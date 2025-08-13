import { Payload } from 'payload'
import { upsertByUniqueField } from '../seed-helpers'

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
      description: 'International healthcare accreditation that evaluates patient safety and quality of care standards.',
    },
    {
      name: 'International Organization for Standardization 9001',
      abbreviation: 'ISO 9001',
      country: 'Switzerland',
      description: 'Quality management system standard ensuring consistent service delivery and continuous improvement.',
    },
    {
      name: 'International Medical Travel and Global Healthcare Accreditation',
      abbreviation: 'TEMOS',
      country: 'Germany',
      description: 'Specialized certification for medical tourism and international patient care quality.',
    },
    {
      name: 'Australian Council on Healthcare Standards',
      abbreviation: 'ACHS',
      country: 'Australia',
      description: 'Healthcare quality improvement and accreditation focusing on patient safety and clinical governance.',
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