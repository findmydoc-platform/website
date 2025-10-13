import type { CollectionAfterDeleteHook } from 'payload'
import type { Clinictreatment } from '@/payload-types'
import { calculateAveragePrice, updateTreatmentAveragePrice } from './averagePriceUtils'

export const updateAveragePriceAfterDelete: CollectionAfterDeleteHook<Clinictreatment> = async ({ doc, req }) => {
  const { payload, context } = req
  if (context.skipHooks) return doc
  
  const suppressLogs = process.env.SUPPRESS_HOOK_LOGS === 'true'
  
  try {
    if (!suppressLogs) {
      payload.logger.info(`Updating average price after clinic treatment delete: ${doc.id}`)
    }
    
    const treatmentId = typeof doc.treatment === 'object' ? doc.treatment?.id : doc.treatment
    if (treatmentId) {
      const avg = await calculateAveragePrice(payload, treatmentId, req)
      await updateTreatmentAveragePrice(payload, treatmentId, avg, context, req)
    }
  } catch (error) {
    payload.logger.error('Error in updateAveragePriceAfterDelete hook', error)
  }
  return doc
}
