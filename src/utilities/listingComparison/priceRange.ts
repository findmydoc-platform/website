export type PriceBounds = {
  min: number
  max: number
}

export const DEFAULT_PRICE_BOUNDS: PriceBounds = {
  min: 0,
  max: 20000,
}

export function normalizePriceBounds(
  bounds?: Partial<PriceBounds>,
  defaults: PriceBounds = DEFAULT_PRICE_BOUNDS,
): PriceBounds {
  const minCandidate = bounds?.min
  const normalizedMin =
    typeof minCandidate === 'number' && Number.isFinite(minCandidate)
      ? Math.max(minCandidate, defaults.min)
      : defaults.min

  const maxCandidate = bounds?.max
  const normalizedMax =
    typeof maxCandidate === 'number' && Number.isFinite(maxCandidate)
      ? Math.max(maxCandidate, normalizedMin)
      : Math.max(defaults.max, normalizedMin)

  return {
    min: normalizedMin,
    max: normalizedMax,
  }
}

export function clampPriceRange(range: [number, number], bounds: PriceBounds): [number, number] {
  const minValue = Number.isFinite(range[0]) ? range[0] : bounds.min
  const maxValue = Number.isFinite(range[1]) ? range[1] : bounds.max
  const lower = Math.min(Math.max(minValue, bounds.min), bounds.max)
  const upper = Math.max(lower, Math.min(Math.max(maxValue, lower), bounds.max))
  return [lower, upper]
}
