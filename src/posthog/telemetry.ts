import { getCurrentIsoTimestampString } from '@/utilities/timestamps'
import { sanitizePostHogRequestUrl } from './exception-context'

export { sanitizePostHogRequestUrl } from './exception-context'

type HeaderRecord = Record<string, string | string[] | undefined>

type RequestHeaderCarrier = {
  headers?: unknown
}

const POSTHOG_SERVER_EXCEPTION_DISTINCT_ID = 'server:website'

export type PostHogRequestErrorContext = {
  method?: string
  route?: string
}

export const readHeader = (request: unknown, name: string): string | null => {
  if (!request || typeof request !== 'object') return null

  const maybeHeaders = (request as RequestHeaderCarrier).headers
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

export const sendRequestErrorToPostHog = async (err: unknown, context: PostHogRequestErrorContext): Promise<void> => {
  const { sendExceptionToPostHog } = await import('./server')
  const route = sanitizePostHogRequestUrl(context.route)

  await sendExceptionToPostHog(err, {
    distinctId: POSTHOG_SERVER_EXCEPTION_DISTINCT_ID,
    method: context.method,
    ...(route ? { properties: { route } } : {}),
    timestamp: getCurrentIsoTimestampString(),
  })
}
