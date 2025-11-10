import { Payload } from 'payload'
import { Review, PlatformStaff, Clinic, Doctor, Treatment } from '@/payload-types'
import { reviewsData } from './reviews-data'

export async function seedReviews(
  payload: Payload,
  {
    patients,
    clinics,
    doctors,
    treatments,
  }: {
    patients: PlatformStaff[]
    clinics: Clinic[]
    doctors: Doctor[]
    treatments: Treatment[]
  },
): Promise<Review[]> {
  payload.logger.info('— Seeding reviews...')

  const createdReviews: Review[] = []

  // Make sure we have the minimum required data
  if (!patients.length || !clinics.length || !doctors.length || !treatments.length) {
    payload.logger.warn('Cannot seed reviews: missing required entity data')
    return []
  }

  const combinations: Array<{
    treatment: Treatment
    clinic: number | Clinic
    doctor: Doctor
    patient: PlatformStaff
    reviewData: (typeof reviewsData)[0]
  }> = []

  // Only create combinations if we have all the required data
  if (treatments[0] && doctors[0] && doctors[0].clinic && patients[0] && reviewsData[0]) {
    combinations.push({
      treatment: treatments[0],
      clinic: doctors[0].clinic,
      doctor: doctors[0],
      patient: patients[0],
      reviewData: reviewsData[0],
    })
  }

  // Create reviews for each unique combination
  for (const { treatment, clinic, doctor, patient, reviewData } of combinations) {
    try {
      const created = (await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: reviewData.starRating,
          comment: reviewData.comment,
          status: reviewData.status as any,
          patient: patient.id,
          clinic: clinic,
          doctor: doctor.id,
          treatment: treatment.id,
        },
      })) as Review

      createdReviews.push(created)
    } catch (e) {
      payload.logger.error(e, 'Error creating review')
    }
  }

  payload.logger.info(`— Finished seeding ${createdReviews.length} reviews.`)
  return createdReviews
}
