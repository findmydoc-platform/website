import { Payload } from 'payload'
import { upsertByUniqueField, textToRichText } from '../seed-helpers'

/**
 * Seed hair transplant and related treatments idempotently.
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
      name: 'FUE Hair Transplant',
      description: 'Follicular unit extraction (FUE) involves harvesting individual hair follicles from a donor area using tiny punches and transplanting them to balding areas; this minimally invasive technique leaves tiny scars and gives a natural look.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'FUT Hair Transplant',
      description: 'Follicular unit transplantation (FUT) removes a strip of scalp from the back of the head, from which hair grafts are dissected and transplanted to balding areas; it typically leaves a linear scar but allows many grafts in one session.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'DHI Hair Transplant',
      description: 'Direct hair implantation (DHI) uses a specialized pen-like device to extract and implant hair follicles individually without creating pre-made incisions, allowing precise placement and reduced trauma.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'Beard Transplant',
      description: 'Beard transplant surgery moves hair follicles from the scalp to the beard area to create or thicken facial hair; it uses FUE or DHI techniques and ensures natural growth direction.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'Eyebrow Transplant',
      description: 'Eyebrow transplantation transfers individual hair follicles from the back of the scalp to the brows to restore density and shape; FUE or DHI techniques are used for precise placement.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'Mustache Transplant',
      description: 'A mustache transplant relocates hair follicles from donor areas to the upper lip to create or enhance a mustache; careful placement mimics natural hair growth.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'Sapphire Hair Transplant',
      description: 'This variation of FUE uses sapphire-tipped blades to create microchannels for grafts, aiming to reduce tissue trauma, speed healing and yield finer results.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
    },
    {
      name: 'PRP Hair Treatment',
      description: 'Platelet-rich plasma (PRP) treatment draws a patient\'s blood, concentrates its platelets and growth factors, then injects it into the scalp to stimulate hair follicle function and promote hair growth.',
      medicalSpecialtyName: 'Hair Loss Clinics / Hair Transplant',
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
      description: textToRichText(treatment.description),
      medicalSpecialty: specialty.id,
    })
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding treatments.')
  return { created, updated }
}