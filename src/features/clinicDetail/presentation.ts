import type { ClinicDetailLocation, ClinicDetailTreatment } from './contracts'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { getClinicProfileTranslator } from './overviewCopy'
import { buildOpenStreetMapViewHref } from '@/utilities/openStreetMap'

const NO_REVIEWS_TEXT = 'No reviews yet'

export function formatTreatmentPrice(price: number | undefined, locale: UiCopyLocale): string {
  const t = getClinicProfileTranslator(locale)
  if (typeof price !== 'number') return t('treatments.priceOnRequest')

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
  return t('treatments.priceFrom', { price: formatted })
}

export function formatRatingSummary(ratingValue?: number | null, reviewCount?: number): string {
  if (typeof ratingValue === 'number' && typeof reviewCount === 'number' && reviewCount > 0) {
    return `${ratingValue.toFixed(1)} (${reviewCount} reviews)`
  }

  return NO_REVIEWS_TEXT
}

export function sortTreatmentsByPrice(
  treatments: ClinicDetailTreatment[],
  locale: UiCopyLocale,
): ClinicDetailTreatment[] {
  return [...treatments].sort((left, right) => {
    const leftPrice = typeof left.priceFrom === 'number' ? left.priceFrom : Number.POSITIVE_INFINITY
    const rightPrice = typeof right.priceFrom === 'number' ? right.priceFrom : Number.POSITIVE_INFINITY

    if (leftPrice !== rightPrice) return leftPrice - rightPrice
    return left.name.localeCompare(right.name, locale)
  })
}

export function buildOpenStreetMapHref(location: ClinicDetailLocation): string | undefined {
  return buildOpenStreetMapViewHref(location)
}
