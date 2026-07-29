const timeInputPattern = /^(\d{1,2})(?::(\d{2}))?$/u

export const normalizeOpeningHoursTimeInput = (value: string): string | null => {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''

  const match = timeInputPattern.exec(trimmedValue)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0

  if (hours > 23 || minutes > 59) return null

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
