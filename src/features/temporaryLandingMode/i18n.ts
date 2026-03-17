export const TEMPORARY_LANDING_LOCALES = ['en', 'de', 'tr'] as const
export const TEMPORARY_LANDING_DEFAULT_LOCALE = 'en'
export const TEMPORARY_LANDING_LANGUAGE_QUERY_KEY = 'lang'

export type TemporaryLandingLocale = (typeof TEMPORARY_LANDING_LOCALES)[number]
type SearchParamValue = string | string[] | undefined
type SearchParamsRecord = Record<string, SearchParamValue>
type SearchParamsInput = SearchParamsRecord | URLSearchParams | undefined | null

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

const getRawLangValue = (input: SearchParamsInput): string | null => {
  if (!input) return null

  if (input instanceof URLSearchParams) {
    return input.get(TEMPORARY_LANDING_LANGUAGE_QUERY_KEY)
  }

  const value = input[TEMPORARY_LANDING_LANGUAGE_QUERY_KEY]
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return typeof value === 'string' ? value : null
}

export const resolveTemporaryLandingLocale = (searchParams: SearchParamsInput): TemporaryLandingLocale => {
  const rawLang = getRawLangValue(searchParams)?.trim().toLowerCase() ?? ''
  if (isTemporaryLandingLocale(rawLang)) {
    return rawLang
  }

  return TEMPORARY_LANDING_DEFAULT_LOCALE
}

export const buildTemporaryLandingLocaleHref = (
  locale: TemporaryLandingLocale,
  searchParams: SearchParamsInput,
): string => {
  const params = toSearchParams(searchParams)
  params.set(TEMPORARY_LANDING_LANGUAGE_QUERY_KEY, locale)

  const query = params.toString()
  return query ? `/?${query}` : '/'
}

export const buildTemporaryLandingLanguageOptions = (
  searchParams: SearchParamsInput,
): TemporaryLandingLanguageOption[] =>
  TEMPORARY_LANDING_LOCALES.map((locale) => ({
    value: locale,
    label: TEMPORARY_LANDING_LABELS[locale],
    href: buildTemporaryLandingLocaleHref(locale, searchParams),
  }))
