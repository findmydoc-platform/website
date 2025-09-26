import { Payload } from 'payload'
import { doctors } from './doctors' // Assuming doctors data is in a separate file
import { createMediaFromURL, seedCollection } from '../seed-helpers'
import { DoctorData } from '../types'
import { Clinic, Doctor } from '@/payload-types'

/**
 * Seeds doctors with proper relationships to clinics
 */
export async function seedDoctors(
  payload: Payload,
  createdClinics: Clinic[],
  uploaderId: string,
): Promise<Doctor[]> {
  payload.logger.info(`— Seeding doctors...`)

  // Step 1: Create a lookup for clinics by name
  const clinicsByName: { [key: string]: Clinic } = createdClinics.reduce(
    (acc: { [key: string]: Clinic }, clinic) => {
      acc[clinic.name] = clinic
      return acc
    },
    {},
  )

  // Step 2: Create doctors with references to clinics
  const doctorDocs = await seedCollection<DoctorData>(
    payload,
    'doctors',
    doctors,
    async (doctorData: DoctorData) => {
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

      try {
        const media = await createMediaFromURL(payload, {
          collection: 'doctorMedia',
          url: doctorData.imageUrl,
          data: {
            alt: `${doctorData.fullName} headshot`,
            doctor: createdDoctor.id,
            createdBy: uploaderId,
          },
        })

        return payload.update({
          collection: 'doctors',
          id: createdDoctor.id,
          data: { profileImage: media.id },
        })
      } catch (error) {
        payload.logger.error(`Failed to create doctor media for ${doctorData.fullName}`, error as Error)
        return createdDoctor
      }
    },
  )
  payload.logger.info(`— Seeding doctors done!`)
  return doctorDocs
}
