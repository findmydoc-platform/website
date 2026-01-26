type HeaderRecord = Record<string, string | string[] | undefined>

export type RequestLike = {
  headers?: unknown
  url?: unknown
  method?: unknown
}

export const readHeader = (request: unknown, name: string): string | null => {
  if (!request || typeof request !== 'object') return null

  const maybeHeaders = (request as RequestLike).headers
  if (!maybeHeaders || typeof maybeHeaders !== 'object') return null

  if ('get' in maybeHeaders && typeof (maybeHeaders as { get?: unknown }).get === 'function') {
    return (maybeHeaders as { get: (key: string) => string | null }).get(name)
  }

  const record = maybeHeaders as HeaderRecord
  const value = record[name] ?? record[name.toLowerCase()]
  if (Array.isArray(value)) return value.join('; ')
  if (typeof value === 'string') return value
  return null
}

export const readRequestMeta = (request: unknown): { url?: string; method?: string } => {
  if (!request || typeof request !== 'object') return {}
  const maybe = request as { url?: unknown; method?: unknown }
  return {
    url: typeof maybe.url === 'string' ? maybe.url : undefined,
    method: typeof maybe.method === 'string' ? maybe.method : undefined,
  }
}

export const extractPostHogDistinctIdFromCookieHeader = (cookieHeader: string | null): string | undefined => {
  if (!cookieHeader) return undefined

  const match = cookieHeader.match(/ph_phc_.*?_posthog=([^;]+)/)
  if (!match?.[1]) return undefined

  try {
    const decodedCookie = decodeURIComponent(match[1])
    const parsed: unknown = JSON.parse(decodedCookie)

    if (parsed && typeof parsed === 'object' && 'distinct_id' in parsed) {
      const distinctId = (parsed as { distinct_id?: unknown }).distinct_id
      return typeof distinctId === 'string' ? distinctId : undefined
    }

    return undefined
  } catch {
    return undefined
  }
}

export const sendRequestErrorToPostHog = async (err: unknown, request: unknown): Promise<void> => {
  const { sendExceptionToPostHog } = await import('./server')

  const cookieHeader = readHeader(request, 'cookie')
  const distinctId = extractPostHogDistinctIdFromCookieHeader(cookieHeader)

  const meta = readRequestMeta(request)

  await sendExceptionToPostHog(err, {
    distinctId,
    url: meta.url,
    method: meta.method,
    userAgent: readHeader(request, 'user-agent') ?? undefined,
    timestamp: new Date().toISOString(),
  })
}
