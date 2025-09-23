import type { CollectionAfterChangeHook } from 'payload'
import type { Clinictreatment } from '@/payload-types'

function getEntityId(entity: any): string | number | null {
  if (!entity) return null
  if (typeof entity === 'string' || typeof entity === 'number') return entity
  return entity.id || null
}

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

async function updateTreatmentAveragePrice(
  payload: any,
  treatmentId: string | number,
  averagePrice: number | null,
  context: any,
  req: any,
) {
  try {
    await payload.update({
      collection: 'treatments',
      id: treatmentId,
      data: { averagePrice },
      context: { ...context, skipHooks: true },
      req,
    })
  } catch (error) {
    payload.logger.error(`Error updating treatment:${treatmentId} average price`, error)
  }
}

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
    payload.logger.error('Error in updateAveragePriceAfterChange hook', error)
  }
  return doc
}
