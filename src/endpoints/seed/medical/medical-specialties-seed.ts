import { Payload } from 'payload'
import { MedicalSpecialty } from '@/payload-types' // Assuming this type is generated

export async function seedMedicalSpecialties(payload: Payload): Promise<MedicalSpecialty[]> {
  payload.logger.info('— Seeding medical specialties (hierarchical)...')

  const parentSpecialtiesData = [
    { name: 'Internal Medicine', description: 'General internal medicine and subspecialties.' },
    { name: 'Surgery', description: 'All surgical specialties.' },
    { name: 'Pediatrics', description: 'Child health.' },
    { name: 'Dentistry', description: 'Dental and oral health.' },
  ]

  const createdSpecialties: MedicalSpecialty[] = []
  // Create parents one by one and collect their IDs
  const parentMap: Record<string, number> = {} // Store ID as number, as that's what Payload returns

  for (const parentData of parentSpecialtiesData) {
    const created = await payload.create({
      collection: 'medical-specialties',
      data: parentData,
    })
    parentMap[parentData.name] = created.id
    createdSpecialties.push(created)
  }

  // Now create child specialties with parent relationships
  const childSpecialtiesData = [
    {
      name: 'Cardiology',
      description: 'Heart and blood vessel specialists.',
      parentSpecialty: parentMap['Internal Medicine'],
    },
    {
      name: 'Neurology',
      description: 'Nervous system disorders.',
      parentSpecialty: parentMap['Internal Medicine'],
    },
    {
      name: 'Dermatology',
      description: 'Skin and related diseases.',
      parentSpecialty: parentMap['Internal Medicine'],
    },
    {
      name: 'Orthopedics',
      description: 'Bones and joints.',
      parentSpecialty: parentMap['Surgery'],
    },
    {
      name: 'General Surgery',
      description: 'Surgical procedures.',
      parentSpecialty: parentMap['Surgery'],
    },
  ]

  for (const childData of childSpecialtiesData) {
    const createdChild = await payload.create({
      collection: 'medical-specialties',
      data: childData,
    })
    createdSpecialties.push(createdChild)
  }

  payload.logger.info('— Finished seeding medical specialties.')
  return createdSpecialties
}
