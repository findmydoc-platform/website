import { Payload } from 'payload'

import { Treatment } from '@/payload-types'
export async function seedTreatments(
  payload: Payload,
  { clinics, doctors, specialties }: { clinics: any[]; doctors: any[]; specialties: any[] },
): Promise<Treatment[]> {
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
              children: [
                {
                  type: 'text',
                  text: 'Root canal treatment for dental patients.',
                },
              ],
            },
          ],
        },
      },
      clinic: clinics[0]?.id,
      doctor: doctors[0]?.id,
      medicalSpecialty: specialties.find((s: any) => s.name === 'Dentistry')?.id,
    },
    {
      name: 'Knee Replacement',
      description: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Surgical procedure to replace the weight-bearing surfaces of the knee joint.',
                },
              ],
            },
          ],
        },
      },
      clinic: clinics[1]?.id,
      doctor: doctors[1]?.id,
      medicalSpecialty: specialties.find((s: any) => s.name === 'Orthopedics')?.id,
    },
    {
      name: 'Cardiac Bypass',
      description: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Surgery to improve blood flow to the heart.',
                },
              ],
            },
          ],
        },
      },
      clinic: clinics[2]?.id,
      doctor: doctors[2]?.id,
      medicalSpecialty: specialties.find((s: any) => s.name === 'Cardiology')?.id,
    },
  ]

  const createdTreatments: Treatment[] = []
  for (const treatment of treatments) {
    const created = (await payload.create({
      collection: 'treatments',
      data: treatment,
    })) as Treatment
    createdTreatments.push(created)
  }
  return createdTreatments
}
