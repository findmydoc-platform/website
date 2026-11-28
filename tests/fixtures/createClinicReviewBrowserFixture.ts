import { createLocalReq, type Payload } from 'payload'

import type { ReviewResponse } from '@/payload-types'
import { reviewModerationPostHandler } from '@/collections/reviews/endpoints'
import { buildRichText } from './richText'
import { createClinicFixture } from './createClinicFixture'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from './testUsers'

export async function createClinicReviewBrowserFixture(payload: Payload) {
  const country = await payload.create({
    collection: 'countries',
    data: { name: 'Germany', isoCode: 'DE', language: 'German', currency: 'EUR' },
  })
  const city = await payload.create({
    collection: 'cities',
    data: { name: 'Berlin', coordinates: [13.405, 52.52], country: country.id },
  })
  const { clinic, doctor } = await createClinicFixture(payload, city.id, { slugPrefix: 'review-browser' })
  await payload.update({ collection: 'clinics', id: clinic.id, data: { status: 'approved' } })
  const medicalSpecialty = await payload.create({
    collection: 'medical-specialties',
    data: { name: 'Diagnostics', displayName: 'Diagnostik', iconKey: 'fallback' },
    locale: 'de',
  })
  const treatment = await payload.create({
    collection: 'treatments',
    data: {
      name: 'Ultrasound',
      displayName: 'Ultraschall',
      description: buildRichText('Ultrasound examination.'),
      medicalSpecialty: medicalSpecialty.id,
    },
    locale: 'de',
  })
  await payload.update({
    collection: 'treatments',
    id: treatment.id,
    data: { displayName: 'Ultrasound' },
    locale: 'en',
  })
  await payload.create({
    collection: 'clinictreatments',
    data: { clinic: clinic.id, treatment: treatment.id, active: true, price: 100 },
  })

  const [author, otherAuthor, moderator, clinicStaff] = await Promise.all([
    createPatientTestUser(payload, { emailPrefix: 'review-browser-author' }),
    createPatientTestUser(payload, { emailPrefix: 'review-browser-placeholder' }),
    createPlatformTestUser(payload, { emailPrefix: 'review-browser-moderator' }),
    createClinicTestUser(payload, { emailPrefix: 'review-browser-clinic-staff' }),
  ])
  const reviewFixture = {
    clinic: clinic.id,
    doctor: doctor.id,
    treatment: treatment.id,
    starRating: 5,
    status: 'approved' as const,
    authorVisibility: 'anonymous' as const,
    publicMeasure: 'none' as const,
    withdrawalState: 'active' as const,
  }
  const originalReview = 'Die Praxis beantwortete meine Fragen zum Termin.'
  const originalResponse = 'Thank you for sharing your experience with us.'
  const hiddenReview = 'This original review text must remain private.'
  const review = await payload.create({
    collection: 'reviews',
    data: { ...reviewFixture, patient: author.id, comment: originalReview, reviewDate: '2026-07-28T10:00:00Z' },
  })
  const hidden = await payload.create({
    collection: 'reviews',
    data: { ...reviewFixture, patient: otherAuthor.id, comment: hiddenReview, reviewDate: '2026-07-26T10:00:00Z' },
  })
  const platformUser = asPayloadStaffUser(moderator)
  const clinicUser = await asClinicScopedPayloadUser(payload, clinicStaff, clinic.id)
  const response = await payload.create({
    collection: 'reviewResponses',
    data: { review: review.id, pendingResponse: { body: originalResponse } } as ReviewResponse,
    user: clinicUser,
    overrideAccess: false,
  })
  await payload.update({
    collection: 'reviewResponses',
    id: response.id,
    data: { moderationStatus: 'approved' },
    user: platformUser,
    overrideAccess: false,
  })
  const req = await createLocalReq({ user: platformUser }, payload)
  req.routeParams = { id: hidden.id }
  req.json = async () => ({ measure: 'placeholder', reason: 'Browser fixture for a public placeholder.' })
  const moderation = await reviewModerationPostHandler(req)
  if (!moderation.ok) throw new Error('Could not prepare the moderated review browser fixture.')

  return {
    clinicId: clinic.id,
    slug: clinic.slug,
    doctorId: doctor.id,
    treatmentId: treatment.id,
    originalReview,
    originalResponse,
    hiddenReview,
  }
}
