import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import type { Review } from '../../payload-types'

// Helper function to extract ID from relationship field (could be ID or full object)
function getEntityId(entity: any): string | number | null {
  if (!entity) return null
  if (typeof entity === 'string' || typeof entity === 'number') return entity
  return entity.id || null
}

// Helper function to calculate average rating for a specific entity
async function calculateAverageRating(
  payload: any,
  collection: string,
  entityId: string | number,
  entityField: string,
  req: any,
): Promise<number | null> {
  try {
    const reviews = await payload.find({
      collection: 'review',
      where: {
        and: [
          {
            [entityField]: {
              equals: entityId,
            },
          },
          {
            status: {
              equals: 'approved',
            },
          },
        ],
      },
      limit: 1000, // Reasonable limit for calculating averages
      req,
    })

    if (!reviews.docs || reviews.docs.length === 0) {
      return null
    }

    const totalRating = reviews.docs.reduce(
      (sum: number, review: any) => sum + (review.starRating || 0),
      0,
    )
    return totalRating / reviews.docs.length
  } catch (error) {
    payload.logger.error(`Error calculating average rating for ${collection}:${entityId}`, error)
    return null
  }
}

// Helper function to update an entity's average rating
async function updateEntityRating(
  payload: any,
  collection: string,
  entityId: string | number,
  averageRating: number | null,
  context: any,
  req: any,
) {
  try {
    await payload.update({
      collection,
      id: entityId,
      data: {
        averageRating,
      },
      context: {
        ...context,
        skipHooks: true, // Prevent infinite loops
      },
      req,
    })
  } catch (error) {
    payload.logger.error(`Error updating ${collection}:${entityId} average rating`, error)
  }
}

export const updateAverageRatingsAfterChange: CollectionAfterChangeHook<Review> = async ({
  doc,
  previousDoc,
  req,
}) => {
  const { payload, context } = req
  // Skip if this update is from a hook to prevent infinite loops
  if (context.skipHooks) {
    return doc
  }

  try {
    payload.logger.info(`Updating average ratings after review change: ${doc.id}`)

    // Update clinic average rating
    const clinicId = getEntityId(doc.clinic)
    if (clinicId) {
      const clinicRating = await calculateAverageRating(payload, 'clinics', clinicId, 'clinic', req)
      await updateEntityRating(payload, 'clinics', clinicId, clinicRating, context, req)
    }

    // Update doctor average rating
    const doctorId = getEntityId(doc.doctor)
    if (doctorId) {
      const doctorRating = await calculateAverageRating(payload, 'doctors', doctorId, 'doctor', req)
      await updateEntityRating(payload, 'doctors', doctorId, doctorRating, context, req)
    }

    // Update treatment average rating
    const treatmentId = getEntityId(doc.treatment)
    if (treatmentId) {
      const treatmentRating = await calculateAverageRating(
        payload,
        'treatments',
        treatmentId,
        'treatment',
        req,
      )
      await updateEntityRating(payload, 'treatments', treatmentId, treatmentRating, context, req)
    }

    // If the clinic, doctor, or treatment changed from the previous version,
    // also update the old entities' ratings
    if (previousDoc) {
      const previousClinicId = getEntityId(previousDoc.clinic)
      if (previousClinicId && previousClinicId !== clinicId) {
        const oldClinicRating = await calculateAverageRating(
          payload,
          'clinics',
          previousClinicId,
          'clinic',
          req,
        )
        await updateEntityRating(
          payload,
          'clinics',
          previousClinicId,
          oldClinicRating,
          context,
          req,
        )
      }

      const previousDoctorId = getEntityId(previousDoc.doctor)
      if (previousDoctorId && previousDoctorId !== doctorId) {
        const oldDoctorRating = await calculateAverageRating(
          payload,
          'doctors',
          previousDoctorId,
          'doctor',
          req,
        )
        await updateEntityRating(
          payload,
          'doctors',
          previousDoctorId,
          oldDoctorRating,
          context,
          req,
        )
      }

      const previousTreatmentId = getEntityId(previousDoc.treatment)
      if (previousTreatmentId && previousTreatmentId !== treatmentId) {
        const oldTreatmentRating = await calculateAverageRating(
          payload,
          'treatments',
          previousTreatmentId,
          'treatment',
          req,
        )
        await updateEntityRating(
          payload,
          'treatments',
          previousTreatmentId,
          oldTreatmentRating,
          context,
          req,
        )
      }
    }
  } catch (error) {
    payload.logger.error('Error in updateAverageRatingsAfterChange hook', error)
  }

  return doc
}

export const updateAverageRatingsAfterDelete: CollectionAfterDeleteHook<Review> = async ({
  doc,
  req,
}) => {
  const { payload, context } = req
  // Skip if this update is from a hook to prevent infinite loops
  if (context.skipHooks) {
    return doc
  }

  try {
    payload.logger.info(`Updating average ratings after review delete: ${doc.id}`)

    // Update clinic average rating
    const clinicId = getEntityId(doc.clinic)
    if (clinicId) {
      const clinicRating = await calculateAverageRating(payload, 'clinics', clinicId, 'clinic', req)
      await updateEntityRating(payload, 'clinics', clinicId, clinicRating, context, req)
    }

    // Update doctor average rating
    const doctorId = getEntityId(doc.doctor)
    if (doctorId) {
      const doctorRating = await calculateAverageRating(payload, 'doctors', doctorId, 'doctor', req)
      await updateEntityRating(payload, 'doctors', doctorId, doctorRating, context, req)
    }

    // Update treatment average rating
    const treatmentId = getEntityId(doc.treatment)
    if (treatmentId) {
      const treatmentRating = await calculateAverageRating(
        payload,
        'treatments',
        treatmentId,
        'treatment',
        req,
      )
      await updateEntityRating(payload, 'treatments', treatmentId, treatmentRating, context, req)
    }
  } catch (error) {
    payload.logger.error('Error in updateAverageRatingsAfterDelete hook', error)
  }

  return doc
}
