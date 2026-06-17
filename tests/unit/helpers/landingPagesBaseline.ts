import baselineGlobals from '@/endpoints/seed/data/baseline/globals.json'
import type { LandingPage } from '@/payload-types'

type BaselineGlobalSeed = {
  slug: string
  data: unknown
}

export const cloneBaselineLandingPages = (): LandingPage => {
  const landingPagesGlobal = (baselineGlobals as unknown as BaselineGlobalSeed[]).find(
    (global) => global.slug === 'landingPages',
  )

  if (!landingPagesGlobal) {
    throw new Error('Expected landingPages baseline global seed')
  }

  return structuredClone(landingPagesGlobal.data) as LandingPage
}
