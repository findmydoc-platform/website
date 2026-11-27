import type { ContentLocaleContext } from '@/utilities/contentLocalization'
import { TURKISH_CLINIC_LANDING_SLUG } from '@/utilities/routing/publicLandingPaths'

export const TEMPORARY_LANDING_LOCALES = ['en', 'de', 'tr'] as const
export const TEMPORARY_LANDING_DEFAULT_LOCALE = 'de'
const TEMPORARY_LANDING_LANGUAGE_QUERY_KEY = 'lang'

export type TemporaryLandingLocale = (typeof TEMPORARY_LANDING_LOCALES)[number]
type SearchParamValue = string | string[] | undefined
type SearchParamsRecord = Record<string, SearchParamValue>
type SearchParamsInput = SearchParamsRecord | URLSearchParams | undefined | null

export const TEMPORARY_LANDING_PATHS = { de: '/', en: '/en', tr: `/${TURKISH_CLINIC_LANDING_SLUG}` } as const

export const temporaryLandingLocaleFromPath = (pathname: string): TemporaryLandingLocale | null => {
  const path = pathname.replace(/\/$/, '') || '/'
  return TEMPORARY_LANDING_LOCALES.find((locale) => TEMPORARY_LANDING_PATHS[locale] === path) ?? null
}

export type TemporaryLandingLanguageOption = {
  href: string
  label: string
  value: TemporaryLandingLocale
}

const TEMPORARY_LANDING_LABELS: Record<TemporaryLandingLocale, string> = {
  en: 'EN',
  de: 'DE',
  tr: 'TR',
}

const isTemporaryLandingLocale = (value: string): value is TemporaryLandingLocale =>
  TEMPORARY_LANDING_LOCALES.includes(value as TemporaryLandingLocale)

const toSearchParams = (input: SearchParamsInput): URLSearchParams => {
  if (!input) {
    return new URLSearchParams()
  }

  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input.toString())
  }

  const params = new URLSearchParams()
  Object.entries(input).forEach(([key, rawValue]) => {
    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) => {
        if (typeof value === 'string') {
          params.append(key, value)
        }
      })
      return
    }

    if (typeof rawValue === 'string') {
      params.set(key, rawValue)
    }
  })

  return params
}

export const buildTemporaryLandingLocaleHref = (
  locale: TemporaryLandingLocale,
  searchParams: SearchParamsInput,
): string => {
  const params = toSearchParams(searchParams)
  params.delete(TEMPORARY_LANDING_LANGUAGE_QUERY_KEY)
  const query = params.toString()
  const pathname = TEMPORARY_LANDING_PATHS[locale]
  return query ? `${pathname}?${query}` : pathname
}

export const getLegacyTemporaryLandingLocation = (url: Pick<URL, 'pathname' | 'searchParams'>): string | null => {
  if (url.pathname !== '/' || !url.searchParams.has(TEMPORARY_LANDING_LANGUAGE_QUERY_KEY)) return null

  const rawLang = url.searchParams.get(TEMPORARY_LANDING_LANGUAGE_QUERY_KEY)?.trim().toLowerCase() ?? ''
  const locale = isTemporaryLandingLocale(rawLang) ? rawLang : TEMPORARY_LANDING_DEFAULT_LOCALE
  return buildTemporaryLandingLocaleHref(locale, url.searchParams)
}

export const buildTemporaryLandingLanguageOptions = (
  searchParams: SearchParamsInput,
): TemporaryLandingLanguageOption[] =>
  TEMPORARY_LANDING_LOCALES.map((locale) => ({
    value: locale,
    label: TEMPORARY_LANDING_LABELS[locale],
    href: buildTemporaryLandingLocaleHref(locale, searchParams),
  }))

export const resolveTemporaryLandingContentLocale = (locale: TemporaryLandingLocale): ContentLocaleContext => {
  if (locale === 'de') {
    return {
      locale: 'de',
      fallbackLocale: 'en',
    }
  }

  return {}
}
