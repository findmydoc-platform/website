export function getCurrentIsoTimestampString(): string {
  return new Date().toISOString()
}

export function parseTimestampStringToMs(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined

  const timestampMs = Date.parse(trimmed)
  return Number.isFinite(timestampMs) ? timestampMs : undefined
}

export function normalizeToIsoTimestampString(value: unknown): string | undefined {
  const timestampMs = parseTimestampStringToMs(value)
  return timestampMs === undefined ? undefined : new Date(timestampMs).toISOString()
}

export function findLatestIsoTimestampString(values: Iterable<unknown>): string | undefined {
  let latestTimestampMs: number | undefined

  for (const value of values) {
    const candidateTimestampMs = parseTimestampStringToMs(value)
    if (candidateTimestampMs === undefined) continue

    if (latestTimestampMs === undefined || candidateTimestampMs > latestTimestampMs) {
      latestTimestampMs = candidateTimestampMs
    }
  }

  return latestTimestampMs === undefined ? undefined : new Date(latestTimestampMs).toISOString()
}
