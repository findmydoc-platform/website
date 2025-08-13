import { Payload } from 'payload'
import { upsertByUniqueField } from '../seed-helpers'

/**
 * Seed canonical medical treatments idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedTreatments(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding treatments (idempotent)...')

  let created = 0
  let updated = 0

  // First, get medical specialties for relationships
  const specialtyMap: Record<string, any> = {}
  const specialties = await payload.find({
    collection: 'medical-specialties',
    limit: 100,
    where: {},
  })

  for (const specialty of specialties.docs) {
    specialtyMap[specialty.name] = specialty
  }

  const treatments = [
    {
      name: 'Hair Transplant',
      description: 'Surgical procedure to restore hair growth in areas of hair loss using follicle transplantation techniques.',
      medicalSpecialtyName: 'Plastic Surgery',
    },
    {
      name: 'Rhinoplasty',
      description: 'Cosmetic or reconstructive surgery to reshape the nose for aesthetic or functional improvements.',
      medicalSpecialtyName: 'Plastic Surgery',
    },
    {
      name: 'Dental Implants',
      description: 'Replacement of missing teeth using titanium implants surgically placed in the jawbone.',
      medicalSpecialtyName: 'Dentistry',
    },
    {
      name: 'IVF',
      description: 'In vitro fertilization treatment to assist with fertility and conception.',
      medicalSpecialtyName: 'Gynecology',
    },
    {
      name: 'LASIK',
      description: 'Laser eye surgery to correct vision problems including nearsightedness, farsightedness, and astigmatism.',
      medicalSpecialtyName: 'Ophthalmology',
    },
  ]

  for (const treatment of treatments) {
    const specialty = specialtyMap[treatment.medicalSpecialtyName]
    if (!specialty) {
      payload.logger.warn(`Medical specialty '${treatment.medicalSpecialtyName}' not found for treatment '${treatment.name}'`)
      continue
    }

    const res = await upsertByUniqueField(payload, 'treatments', 'name', {
      name: treatment.name,
      description: treatment.description,
      medicalSpecialty: specialty.id,
    })
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding treatments.')
  return { created, updated }
}