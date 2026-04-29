type SearchParamValue = string | string[] | null | undefined

export const CONTENT_LOCALES = ['en', 'de'] as const
export const DEFAULT_CONTENT_LOCALE = 'en' as const

export type ContentLocale = (typeof CONTENT_LOCALES)[number]
export type ContentFallbackLocale = ContentLocale | false
export type ContentLocaleContext = {
  locale?: ContentLocale
  fallbackLocale?: ContentFallbackLocale
}
export type ContentLocaleQueryOptions = ContentLocaleContext

export const isContentLocale = (value: string): value is ContentLocale =>
  CONTENT_LOCALES.includes(value as ContentLocale)

const getFirstSearchParamValue = (value: SearchParamValue): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return typeof value === 'string' ? value : null
}

export const getRequestedContentLocale = (value: SearchParamValue): ContentLocale | undefined => {
  const rawValue = getFirstSearchParamValue(value)?.trim().toLowerCase()

  if (!rawValue || !isContentLocale(rawValue) || rawValue === DEFAULT_CONTENT_LOCALE) {
    return undefined
  }

  return rawValue
}

export const resolveContentLocaleContext = (value: SearchParamValue): ContentLocaleContext => {
  const locale = getRequestedContentLocale(value)

  if (!locale) {
    return {}
  }

  return {
    locale,
    fallbackLocale: DEFAULT_CONTENT_LOCALE,
  }
}

export const appendContentLocaleToPath = (path: string, locale?: ContentLocale | null): string => {
  if (!locale || locale === DEFAULT_CONTENT_LOCALE) {
    return path
  }

  const url = new URL(path, 'https://findmydoc.invalid')
  url.searchParams.set('locale', locale)

  return `${url.pathname}${url.search}${url.hash}`
}

export const getLocalizedStringValue = (
  value: unknown,
  locale: ContentLocale = DEFAULT_CONTENT_LOCALE,
): string | undefined => {
  if (typeof value === 'string') {
    return value
  }

  if (!value || typeof value !== 'object') {
    return undefined
  }

  const localizedValue = value as Partial<Record<ContentLocale, unknown>>
  const requestedValue = localizedValue[locale]

  if (typeof requestedValue === 'string') {
    return requestedValue
  }

  for (const candidateLocale of CONTENT_LOCALES) {
    const candidateValue = localizedValue[candidateLocale]

    if (typeof candidateValue === 'string') {
      return candidateValue
    }
  }

  return undefined
}
