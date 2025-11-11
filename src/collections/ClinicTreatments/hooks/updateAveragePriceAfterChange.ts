import type { CollectionAfterChangeHook } from 'payload'
import type { Clinictreatment } from '@/payload-types'
import { getEntityId, calculateAveragePrice, updateTreatmentAveragePrice } from './averagePriceUtils'

export const updateAveragePriceAfterChange: CollectionAfterChangeHook<Clinictreatment> = async ({
  doc,
  previousDoc,
  req,
}) => {
  const { payload, context } = req
  if (context.skipHooks) return doc
  try {
    const treatmentId = getEntityId(doc.treatment)
    if (treatmentId) {
      const avg = await calculateAveragePrice(payload, treatmentId, req)
      await updateTreatmentAveragePrice(payload, treatmentId, avg, context, req)
    }
    if (previousDoc) {
      const prevId = getEntityId(previousDoc.treatment)
      if (prevId && prevId !== treatmentId) {
        const oldAvg = await calculateAveragePrice(payload, prevId, req)
        await updateTreatmentAveragePrice(payload, prevId, oldAvg, context, req)
      }
    }
  } catch (error) {
    payload.logger.error(error, 'Error in updateAveragePriceAfterChange hook')
  }
  return doc
}
