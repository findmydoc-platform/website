import { Payload } from 'payload'
import { clinics } from './clinics'
import { doctors } from './doctors'
import { createMediaFromURL, seedCollection } from '../seed-helpers'
import { ClinicData, DoctorData } from '../types'
import { City } from '@/payload-types'

/**
 * Seeds clinics and doctors with proper relationships
 */
export async function seedClinicsAndDoctors(payload: Payload, cities: City[]): Promise<void> {
  payload.logger.info(`— Seeding plastic surgery clinics...`)

  // we just guess it exists since we define it anyway
  // Step 0: Set the city for each clinic
  clinics[0]!.address.city = cities[0]!
  clinics[1]!.address.city = cities[1]!
  clinics[2]!.address.city = cities[2]!

  // Step 1: Create clinic images
  const clinicImages = await Promise.all(
    clinics.map((clinic: ClinicData) =>
      createMediaFromURL(payload, clinic.imageUrl, `${clinic.name} building`),
    ),
  )

  // Step 2: Create clinics
  const clinicDocs = await seedCollection(
    payload,
    'clinics',
    clinics,
    async (clinicData: ClinicData, index: number) => {
      return payload.create({
        collection: 'clinics',
        data: {
          name: clinicData.name,
          address: {
            street: clinicData.address.street,
            houseNumber: clinicData.address.houseNumber,
            zipCode: clinicData.address.zipCode,
            country: clinicData.address.country,
            city: clinicData.address.city,
          },
          contact: clinicData.contact,
          thumbnail: clinicImages[index].id,
          slug: `clinic-${index + 1}`,
          supportedLanguages: clinicData.supportedLanguages,
          status: clinicData.status,
        },
      })
    },
  )

  // Step 3: Create a lookup for clinics by name
  const clinicsByName = clinicDocs.reduce((acc, clinic) => {
    acc[clinic.name] = clinic
    return acc
  }, {})

  payload.logger.info(`— Seeding plastic surgeons...`)

  // Step 4: Create doctor images
  const doctorImages = await Promise.all(
    doctors.map((doctor) =>
      createMediaFromURL(payload, doctor.imageUrl, `${doctor.fullName} headshot`),
    ),
  )

  // Step 5: Create doctors with references to clinics
  await seedCollection(
    payload,
    'doctors',
    doctors,
    async (doctorData: DoctorData, index: number) => {
      const clinic = clinicsByName[doctorData.clinicName]

      if (!clinic) {
        throw new Error(`Clinic not found for doctor ${doctorData.fullName}`)
      }

      return payload.create({
        collection: 'doctors',
        data: {
          fullName: doctorData.fullName,
          title: doctorData.title,
          clinic: clinic.id,
          specialization: doctorData.specialization,
          contact: doctorData.contact,
          image: doctorImages[index].id,
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
          active: doctorData.active,
        },
      })
    },
  )
}
