const REQUEST_URL_BASE = 'https://findmydoc.invalid'
const MAX_REQUEST_URL_LENGTH = 2048
const SENSITIVE_EXCEPTION_PROPERTY_NAME = /authorization|cookie|credential|header|password|secret|token|query/i
const SENSITIVE_EXCEPTION_PROPERTY_VALUE =
  /\b(?:basic|bearer|digest)\s+\S+|(?:access[_-]?token|api[_-]?key|authorization|cookie|credential|password|secret|session|token)\s*[:=]/i
const URL_WITH_UNSAFE_SUFFIX = /(?:https?:\/\/|\/)\S*[?#]\S*/i

export const sanitizePostHogRequestUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined

  try {
    const parsed = new URL(url, REQUEST_URL_BASE)
    return parsed.pathname.slice(0, MAX_REQUEST_URL_LENGTH)
  } catch {
    const [path] = url.split(/[?#]/)
    const normalizedPath = path?.trim()
    return normalizedPath ? normalizedPath.slice(0, MAX_REQUEST_URL_LENGTH) : undefined
  }
}

export const sanitizeExceptionProperties = (properties: Record<string, boolean | number | string | null>) =>
  Object.fromEntries(
    Object.entries(properties).flatMap(([key, value]) => {
      if (SENSITIVE_EXCEPTION_PROPERTY_NAME.test(key)) return []

      if (typeof value === 'string') {
        if (key.toLowerCase().includes('url')) {
          const sanitizedUrl = sanitizePostHogRequestUrl(value)
          return sanitizedUrl === undefined ? [] : [[key, sanitizedUrl]]
        }

        if (SENSITIVE_EXCEPTION_PROPERTY_VALUE.test(value)) return []

        if (URL_WITH_UNSAFE_SUFFIX.test(value)) return []
      }

      return [[key, value]]
    }),
  )
