import type { Payload, PayloadRequest } from 'payload'
import type { Clinictreatment as ClinicTreatment } from '@/payload-types'

export function getEntityId(
  entity: string | number | { id: string | number } | null | undefined,
): string | number | null {
  if (!entity) return null
  if (typeof entity === 'string' || typeof entity === 'number') return entity
  return entity.id || null
}

export async function calculateAveragePrice(
  payload: Payload,
  treatmentId: string | number,
  req: PayloadRequest,
): Promise<number | null> {
  try {
    const clinicTreatments = await payload.find({
      collection: 'clinictreatments',
      where: { treatment: { equals: treatmentId } },
      limit: 1000,
      req,
    })

    if (!clinicTreatments.docs?.length) return null

    const validPrices = clinicTreatments.docs
      .map((ct) => (ct as ClinicTreatment).price)
      .filter((price): price is number => typeof price === 'number' && !Number.isNaN(price) && price >= 0)

    if (validPrices.length === 0) return null

    const total = validPrices.reduce((sum: number, p: number) => sum + p, 0)
    return total / validPrices.length
  } catch (error) {
    payload.logger.error(error, `Error calculating average price for treatment:${treatmentId}`)
    return null
  }
}

export async function updateTreatmentAveragePrice(
  payload: Payload,
  treatmentId: string | number,
  averagePrice: number | null,
  context: Record<string, unknown>,
  req: PayloadRequest,
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
    payload.logger.error(error, `Error updating treatment:${treatmentId} average price`)
  }
}
