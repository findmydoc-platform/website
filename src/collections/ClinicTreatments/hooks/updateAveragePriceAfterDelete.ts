import type { CollectionAfterDeleteHook } from 'payload'
import type { Clinictreatment } from '@/payload-types'

async function calculateAveragePrice(payload: any, treatmentId: string | number, req: any): Promise<number | null> {
  try {
    const clinicTreatments = await payload.find({
      collection: 'clinictreatments',
      where: { treatment: { equals: treatmentId } },
      limit: 1000,
      req,
    })
    if (!clinicTreatments.docs?.length) return null
    const valid = clinicTreatments.docs.map((ct: any) => ct.price).filter((p: number) => p != null && p > 0)
    if (!valid.length) return null
    const total = valid.reduce((sum: number, p: number) => sum + p, 0)
    return total / valid.length
  } catch (error) {
    payload.logger.error(`Error calculating average price for treatment:${treatmentId}`, error)
    return null
  }
}

export const updateAveragePriceAfterDelete: CollectionAfterDeleteHook<Clinictreatment> = async ({ doc, req }) => {
  const { payload, context } = req
  if (context.skipHooks) return doc
  try {
    const treatmentId = typeof doc.treatment === 'object' ? doc.treatment?.id : doc.treatment
    if (treatmentId) {
      const avg = await calculateAveragePrice(payload, treatmentId, req)
      await payload.update({
        collection: 'treatments',
        id: treatmentId,
        data: { averagePrice: avg },
        context: { ...context, skipHooks: true },
        req,
      })
    }
  } catch (error) {
    payload.logger.error('Error in updateAveragePriceAfterDelete hook', error)
  }
  return doc
}
