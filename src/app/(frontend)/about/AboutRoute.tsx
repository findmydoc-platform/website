import type { Metadata } from 'next'

import { AboutPage } from '@/components/templates/AboutPage/Component'
import { resolveEditorialLandingRoute } from '../_data/editorialLandingRoute'
import { getAboutPageCopy } from '@/features/uiCopy/aboutPage'
import { ABOUT_PATHS } from '@/i18n/editorialLandingPaths'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { getAboutLandingContent } from '@/utilities/landing/landingPageContent'

export async function renderAboutPage(locale: ContentLocale) {
  const route = await resolveEditorialLandingRoute('about', ABOUT_PATHS, locale)
  if (!route.available) return route.renderUnavailable()

  const content = await getAboutLandingContent(locale)

  return (
    <>
      {route.switcher}
      <AboutPage
        hero={content.hero}
        why={content.why}
        team={content.team}
        transparency={content.transparency}
        copy={getAboutPageCopy(locale)}
      />
    </>
  )
}

export async function aboutMetadata(locale: ContentLocale): Promise<Metadata> {
  const route = await resolveEditorialLandingRoute('about', ABOUT_PATHS, locale)
  return route.metadata(route.available ? (await getAboutLandingContent(locale)).metadata : undefined)
}
