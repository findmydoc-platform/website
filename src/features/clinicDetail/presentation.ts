import type { ClinicDetailLocation, ClinicDetailTreatment } from './contracts'
import { buildOpenStreetMapViewHref } from '@/utilities/openStreetMap'

const NO_REVIEWS_TEXT = 'No reviews yet'

export function formatEur(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatRatingSummary(ratingValue?: number | null, reviewCount?: number): string {
  if (typeof ratingValue === 'number' && typeof reviewCount === 'number' && reviewCount > 0) {
    return `${ratingValue.toFixed(1)} (${reviewCount} reviews)`
  }

  return NO_REVIEWS_TEXT
}

export function sortTreatmentsByPrice(treatments: ClinicDetailTreatment[]): ClinicDetailTreatment[] {
  return [...treatments].sort((left, right) => {
    const leftPrice = typeof left.priceFrom === 'number' ? left.priceFrom : Number.POSITIVE_INFINITY
    const rightPrice = typeof right.priceFrom === 'number' ? right.priceFrom : Number.POSITIVE_INFINITY

    if (leftPrice !== rightPrice) return leftPrice - rightPrice
    return left.name.localeCompare(right.name, 'en')
  })
}

export function buildOpenStreetMapHref(location: ClinicDetailLocation): string | undefined {
  return buildOpenStreetMapViewHref(location)
}
