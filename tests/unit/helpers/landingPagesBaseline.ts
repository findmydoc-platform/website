import baselineGlobals from '@/endpoints/seed/data/baseline/globals.json'
import type { LandingPage } from '@/payload-types'
import type { ContentLocale } from '@/utilities/contentLocalization'

type BaselineGlobalSeed = {
  slug: string
  data: unknown
}

export const cloneBaselineLandingPages = (locale: ContentLocale = 'de'): LandingPage => {
  const landingPagesGlobal = (baselineGlobals as unknown as BaselineGlobalSeed[]).find(
    (global) => global.slug === 'landingPages',
  )

  if (!landingPagesGlobal) {
    throw new Error('Expected landingPages baseline global seed')
  }

  return JSON.parse(JSON.stringify(landingPagesGlobal.data), (_key, value: unknown) => {
    if (value && typeof value === 'object' && 'de' in value && 'en' in value) return value[locale]
    return value
  }) as LandingPage
}
