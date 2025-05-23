import { Payload } from 'payload'
import { clinics as clinicDataArray } from './clinics' // Assuming clinics.ts exports the raw data array
import { createMediaFromURL, seedCollection } from '../seed-helpers'
import { ClinicData } from '../types'
import { City, Clinic } from '@/payload-types'

export async function seedClinics(payload: Payload, cities: City[]): Promise<Clinic[]> {
  payload.logger.info(`— Seeding clinics...`)

  // Step 0: Set the city for each clinic
  // This assumes clinicDataArray is mutable and the same instance is used by reference.
  // It might be cleaner to map to new objects if clinicDataArray is imported and used elsewhere.
  if (cities[0]) clinicDataArray[0]!.address.city = cities[0].id
  if (cities[1]) clinicDataArray[1]!.address.city = cities[1].id
  if (cities[2]) clinicDataArray[2]!.address.city = cities[2].id
  // Add more city assignments if there are more clinics/cities

  payload.logger.info(`— Seeding clinic images...`)

  // Step 1: Create clinic images
  const clinicImages = await Promise.all(
    clinicDataArray.map((clinic: ClinicData) =>
      createMediaFromURL(payload, clinic.imageUrl, `${clinic.name} building`),
    ),
  )
  payload.logger.info(`— Seeding clinic images done!`)

  // Step 2: Create clinics
  const createdClinicDocs = await seedCollection<ClinicData>(
    payload,
    'clinics',
    clinicDataArray,
    async (clinicData: ClinicData, index: number) => {
      payload.logger.info(`— Seeding clinic ${clinicData.name}...`)
      if (!clinicData.address.city) {
        payload.logger.warn(
          `City not found for clinic ${clinicData.name} with address: ${JSON.stringify(
            clinicData.address,
          )}`,
        )
      }

      return payload.create({
        collection: 'clinics',
        data: {
          name: clinicData.name,
          address: {
            street: clinicData.address.street,
            houseNumber: clinicData.address.houseNumber,
            zipCode: clinicData.address.zipCode,
            country: clinicData.address.country,
            city: clinicData.address.city, // This should be the ID of a City document
          },
          contact: clinicData.contact,
          thumbnail: clinicImages[index]?.id, // Use optional chaining for safety
          slug: `clinic-${index + 1}`,
          supportedLanguages: clinicData.supportedLanguages,
          status: clinicData.status,
        },
      })
    },
  )
  payload.logger.info('— Finished seeding clinics.')
  return createdClinicDocs
}
