export function getEntityId(entity: any): string | number | null {
  if (!entity) return null
  if (typeof entity === 'string' || typeof entity === 'number') return entity
  return entity.id || null
}

export async function calculateAveragePrice(
  payload: any,
  treatmentId: string | number,
  req: any,
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
      .map((ct: any) => ct.price)
      .filter((price: unknown) => typeof price === 'number' && !Number.isNaN(price) && price >= 0)

    if (validPrices.length === 0) return null

    const total = validPrices.reduce((sum: number, p: number) => sum + p, 0)
    return total / validPrices.length
  } catch (error) {
    payload.logger.error(error, `Error calculating average price for treatment:${treatmentId}`)
    return null
  }
}

export async function updateTreatmentAveragePrice(
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
    payload.logger.error(error, `Error updating treatment:${treatmentId} average price`)
  }
}

