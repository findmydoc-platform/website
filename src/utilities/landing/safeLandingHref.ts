type LandingHrefOptions = {
  allowInternalPath?: boolean
  allowedHosts?: readonly string[]
}

type LandingHrefValidationOptions = LandingHrefOptions & {
  message: string
}

const hasControlCharacters = (value: string): boolean => /[\u0000-\u001F\u007F]/.test(value)

const isSafeHashHref = (value: string): boolean => value === '#' || /^#[A-Za-z0-9_-]+$/.test(value)

const isSafeInternalPath = (value: string): boolean =>
  value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !hasControlCharacters(value)

const hostMatches = (hostname: string, allowedHosts: readonly string[]): boolean =>
  allowedHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`))

const isSafeHttpsHref = (value: string, allowedHosts?: readonly string[]): boolean => {
  try {
    const url = new URL(value)

    if (url.protocol !== 'https:') return false
    if (allowedHosts && allowedHosts.length > 0) {
      const normalizedAllowedHosts = allowedHosts.map((allowedHost) => allowedHost.toLowerCase())
      return hostMatches(url.hostname.toLowerCase(), normalizedAllowedHosts)
    }

    return true
  } catch {
    return false
  }
}

export const normalizeSafeLandingHref = (
  value: string | null | undefined,
  options: LandingHrefOptions = {},
): string | undefined => {
  if (typeof value !== 'string') return undefined

  const href = value.trim()
  if (href.length === 0) return undefined
  if (isSafeHashHref(href)) return href
  if (options.allowInternalPath && isSafeInternalPath(href)) return href
  if (isSafeHttpsHref(href, options.allowedHosts)) return href

  return undefined
}

export const validateLandingHref = (
  value: string | string[] | null | undefined,
  options: LandingHrefValidationOptions,
): true | string => {
  if (Array.isArray(value)) return options.message
  if (value === null || value === undefined || value.trim().length === 0) return true

  return normalizeSafeLandingHref(value, options) ? true : options.message
}

export const landingSocialHosts = {
  github: ['github.com'],
  instagram: ['instagram.com'],
  linkedin: ['linkedin.com'],
  meta: ['facebook.com', 'meta.com'],
  x: ['x.com', 'twitter.com'],
} as const
