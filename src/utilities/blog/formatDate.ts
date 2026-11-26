/**
 * Format ISO date string using the selected locale
 * @param isoDate - ISO 8601 date string (e.g., "2026-01-15T10:00:00.000Z")
 * @param locale - Locale used to format the date
 * @returns Formatted date string (e.g., "15. Januar 2026")
 */
export function formatDate(isoDate: string | Date, locale = 'de-DE'): string {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
