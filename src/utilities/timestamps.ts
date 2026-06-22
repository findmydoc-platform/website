export function normalizeToIsoTimestampString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return undefined

  return date.toISOString()
}

export function findLatestIsoTimestampString(values: Iterable<unknown>): string | undefined {
  let latestDate: Date | undefined

  for (const value of values) {
    const normalized = normalizeToIsoTimestampString(value)
    if (!normalized) continue

    const candidateDate = new Date(normalized)
    if (!latestDate || candidateDate.getTime() > latestDate.getTime()) {
      latestDate = candidateDate
    }
  }

  return latestDate?.toISOString()
}
