import { cache } from 'react'

import type { LandingPage } from '@/payload-types'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { getCachedGlobal } from '@/utilities/getGlobals'

export type EditorialLanding = 'about' | 'clinicPartners'

// Fixed Landing Pages have no draft versions. A headline identifies an
// authored rendition without coupling its availability to other documents.
export function hasEditorialLanding(global: Partial<LandingPage>, page: EditorialLanding) {
  return Boolean(global[page]?.hero?.title?.trim())
}

const readLocalizedLandingPages = cache(
  async (locale: ContentLocale) => getCachedGlobal('landingPages', 0, locale)() as Promise<LandingPage>,
)

export async function getEditorialLandingLanguages(page: EditorialLanding) {
  const [de, en] = await Promise.all([readLocalizedLandingPages('de'), readLocalizedLandingPages('en')])

  return { de: hasEditorialLanding(de, page), en: hasEditorialLanding(en, page) }
}
