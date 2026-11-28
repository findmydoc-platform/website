import type { UiCopyLocale } from '@/i18n/requestLocale'

type NamedTaxonomyRecord = {
  name: string
  displayName?: unknown
}

function displayName(record: NamedTaxonomyRecord, locale: UiCopyLocale): string | undefined {
  const localized = record.displayName
  // Payload returns a locale map when read with locale: 'all'.
  const value = localized && typeof localized === 'object' ? (localized as Record<string, unknown>)[locale] : localized
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function getTaxonomyDisplayName(record: NamedTaxonomyRecord, locale: UiCopyLocale): string {
  return displayName(record, locale) ?? record.name
}

export function getTaxonomySearchLabels(record: NamedTaxonomyRecord): string[] {
  return [...new Set([record.name, displayName(record, 'de'), displayName(record, 'en')])].filter(
    (value): value is string => typeof value === 'string' && Boolean(value.trim()),
  )
}
