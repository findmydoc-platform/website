import { Payload } from 'payload'

import { Treatment, Clinic, Doctor, MedicalSpecialty } from '@/payload-types'

export async function seedTreatments(
  payload: Payload,
  { clinics, doctors, specialties }: { clinics: Clinic[]; doctors: Doctor[]; specialties: MedicalSpecialty[] },
): Promise<Treatment[]> {
  const fallbackSpecialtyId = specialties[0]?.id
  if (fallbackSpecialtyId == null) {
    throw new Error('No medical specialties available for seeding treatments')
  }

  // Example: Use the first specialty as the category for each treatment
  const treatments = [
    {
      name: 'Root Canal',
      description: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'Root canal treatment for dental patients.',
                },
              ],
            },
          ],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
        },
      },
      clinic: clinics[0]?.id,
      doctor: doctors[0]?.id,
      medicalSpecialty: specialties.find((s) => s.name === 'Dentistry')?.id ?? fallbackSpecialtyId,
    },
    {
      name: 'Knee Replacement',
      description: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'Surgical procedure to replace the weight-bearing surfaces of the knee joint.',
                },
              ],
            },
          ],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
        },
      },
      clinic: clinics[1]?.id,
      doctor: doctors[1]?.id,
      medicalSpecialty: specialties.find((s) => s.name === 'Orthopedics')?.id ?? fallbackSpecialtyId,
    },
    {
      name: 'Cardiac Bypass',
      description: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'Surgery to improve blood flow to the heart.',
                },
              ],
            },
          ],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
        },
      },
      clinic: clinics[2]?.id,
      doctor: doctors[2]?.id,
      medicalSpecialty: specialties.find((s) => s.name === 'Cardiology')?.id ?? fallbackSpecialtyId,
    },
  ]

  const createdTreatments: Treatment[] = []
  for (const treatment of treatments) {
    const created = (await payload.create({
      collection: 'treatments',
      data: treatment,
      draft: false,
    })) as Treatment
    createdTreatments.push(created)
  }
  return createdTreatments
}
