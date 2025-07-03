import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import type { Clinictreatment } from '../../payload-types'

// Helper function to extract ID from relationship field (could be ID or full object)
function getEntityId(entity: any): string | number | null {
  if (!entity) return null
  if (typeof entity === 'string' || typeof entity === 'number') return entity
  return entity.id || null
}

// Helper function to calculate average price for a treatment
async function calculateAveragePrice(
  payload: any,
  treatmentId: string | number,
): Promise<number | null> {
  try {
    const clinicTreatments = await payload.find({
      collection: 'clinictreatments',
      where: {
        treatment: {
          equals: treatmentId,
        },
      },
      limit: 1000, // Reasonable limit for calculating averages
    })

    if (!clinicTreatments.docs || clinicTreatments.docs.length === 0) {
      return null
    }

    // Filter out any clinic treatments without valid prices
    const validPrices = clinicTreatments.docs
      .map((ct: any) => ct.price)
      .filter((price: number) => price !== null && price !== undefined && price > 0)

    if (validPrices.length === 0) {
      return null
    }

    const totalPrice = validPrices.reduce((sum: number, price: number) => sum + price, 0)
    return totalPrice / validPrices.length
  } catch (error) {
    payload.logger.error(`Error calculating average price for treatment:${treatmentId}`, error)
    return null
  }
}

// Helper function to update a treatment's average price
async function updateTreatmentAveragePrice(
  payload: any,
  treatmentId: string | number,
  averagePrice: number | null,
  context: any,
) {
  try {
    await payload.update({
      collection: 'treatments',
      id: treatmentId,
      data: {
        averagePrice,
      },
      context: {
        ...context,
        skipHooks: true, // Prevent infinite loops
      },
    })
  } catch (error) {
    payload.logger.error(`Error updating treatment:${treatmentId} average price`, error)
  }
}

export const updateAveragePriceAfterChange: CollectionAfterChangeHook<Clinictreatment> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  // Skip if this update is from a hook to prevent infinite loops
  if (context.skipHooks) {
    return doc
  }

  try {
    payload.logger.info(`Updating average price after clinic treatment change: ${doc.id}`)

    // Update treatment average price for the current treatment
    const treatmentId = getEntityId(doc.treatment)
    if (treatmentId) {
      const averagePrice = await calculateAveragePrice(payload, treatmentId)
      await updateTreatmentAveragePrice(payload, treatmentId, averagePrice, context)
    }

    // If the treatment changed from the previous version, also update the old treatment's price
    if (previousDoc) {
      const previousTreatmentId = getEntityId(previousDoc.treatment)
      if (previousTreatmentId && previousTreatmentId !== treatmentId) {
        const oldAveragePrice = await calculateAveragePrice(payload, previousTreatmentId)
        await updateTreatmentAveragePrice(payload, previousTreatmentId, oldAveragePrice, context)
      }
    }
  } catch (error) {
    payload.logger.error('Error in updateAveragePriceAfterChange hook', error)
  }

  return doc
}

export const updateAveragePriceAfterDelete: CollectionAfterDeleteHook<Clinictreatment> = async ({
  doc,
  req: { payload, context },
}) => {
  // Skip if this update is from a hook to prevent infinite loops
  if (context.skipHooks) {
    return doc
  }

  try {
    payload.logger.info(`Updating average price after clinic treatment delete: ${doc.id}`)

    // Update treatment average price
    const treatmentId = getEntityId(doc.treatment)
    if (treatmentId) {
      const averagePrice = await calculateAveragePrice(payload, treatmentId)
      await updateTreatmentAveragePrice(payload, treatmentId, averagePrice, context)
    }
  } catch (error) {
    payload.logger.error('Error in updateAveragePriceAfterDelete hook', error)
  }

  return doc
}