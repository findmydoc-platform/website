import { Payload } from 'payload'
import { doctors } from './doctors'
import { seedCollection } from '../seed-helpers'
import { DoctorData } from '../types'
import { slugify } from '@/utilities/slugify'
import { Clinic, Doctor } from '@/payload-types'

/**
 * Seeds doctors with proper relationships to clinics.
 * (Doctor profile image/media seeding temporarily disabled pending redesign.)
 */
export async function seedDoctors(payload: Payload, createdClinics: Clinic[]): Promise<Doctor[]> {
  payload.logger.info('— Seeding doctors...')

  const clinicsByName: Record<string, Clinic> = createdClinics.reduce(
    (acc, clinic) => {
      acc[clinic.name] = clinic
      return acc
    },
    {} as Record<string, Clinic>,
  )

  const doctorDocs = await seedCollection<DoctorData>(payload, 'doctors', doctors, async (doctorData: DoctorData) => {
    const clinic = clinicsByName[doctorData.clinicName]
    if (!clinic) {
      throw new Error(
        `Clinic not found for doctor ${doctorData.fullName}. Available clinics: ${Object.keys(clinicsByName).join(', ')}`,
      )
    }

    const createdDoctor = await payload.create({
      collection: 'doctors',
      data: {
        firstName: doctorData.firstName,
        lastName: doctorData.lastName,
        fullName: doctorData.fullName,
        slug: doctorData.slug ?? slugify(doctorData.fullName),
        title: doctorData.title as 'dr' | 'specialist' | 'surgeon' | 'assoc_prof' | 'prof_dr',
        clinic: clinic.id,
        qualifications: doctorData.qualifications,
        biography: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ text: doctorData.biography, type: 'text', version: 1 }],
                direction: null,
                format: '',
                indent: 0,
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            version: 1,
          },
        },
        languages: doctorData.languages,
        experienceYears: doctorData.experienceYears,
        averageRating: doctorData.rating,
      },
    })

    return createdDoctor
  })

  payload.logger.info('— Seeding doctors done!')
  return doctorDocs
}
