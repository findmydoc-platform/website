import { Payload } from 'payload'
import { clinics } from './clinics'
import { plasticSurgeons } from './plastic-surgeons'
import { createMediaFromURL, seedCollection } from '../seed-helpers'
import { ClinicData, DoctorData } from '../types'

/**
 * Seeds clinics and doctors with proper relationships
 */
export async function seedClinicsAndDoctors(payload: Payload): Promise<void> {
  payload.logger.info(`— Seeding plastic surgery clinics...`)

  // Step 1: Create clinic images
  const clinicImages = await Promise.all(
    clinics.map((clinic: ClinicData) =>
      createMediaFromURL(payload, clinic.imageUrl, `${clinic.name} building`),
    ),
  )

  // Step 3: Get Cities

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
            country: clinicData.address.countryName,
            city: clinicData.address.cityName,
          },
          contact: clinicData.contact,
          thumbnail: clinicImages[index].id,
          slug: `clinic-${index + 1}`,
          supportedLanguages: clinicData.supportedLanguages,
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
    plasticSurgeons.map((doctor) =>
      createMediaFromURL(payload, doctor.imageUrl, `${doctor.fullName} headshot`),
    ),
  )

  // Step 5: Create doctors with references to clinics
  const doctorDocs = await seedCollection(
    payload,
    'doctors',
    plasticSurgeons,
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

  // Step 6: Update clinics with assigned doctors
  for (const doctor of doctorDocs) {
    const clinic = await payload.findByID({
      collection: 'clinics',
      id: doctor.clinic.id,
    })

    await payload.update({
      collection: 'clinics',
      id: doctor.clinic.id,
      data: {
        assignedDoctors: [...(clinic.assignedDoctors || []), doctor.id],
      },
    })
  }
}
