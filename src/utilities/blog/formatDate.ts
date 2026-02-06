/**
 * Format ISO date string to German locale format
 * @param isoDate - ISO 8601 date string (e.g., "2026-01-15T10:00:00.000Z")
 * @returns Formatted date string (e.g., "15. Januar 2026")
 */
export function formatDate(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
