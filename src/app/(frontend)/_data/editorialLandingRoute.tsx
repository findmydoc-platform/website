import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { CmsTranslationUnavailable, cmsTranslationNoticeTitle } from '../_components/CmsTranslationUnavailable'
import { LanguageSwitchRoute } from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { getEditorialLandingLanguages, type EditorialLanding } from '@/utilities/landing/editorialLandingAvailability'

export async function resolveEditorialLandingRoute(
  page: EditorialLanding,
  paths: Record<ContentLocale, string>,
  locale: ContentLocale,
) {
  const available = await getEditorialLandingLanguages(page)
  const canonical = paths[locale]

  return {
    available: available[locale],
    renderUnavailable() {
      if (locale === 'en' && available.de) return <CmsTranslationUnavailable germanPath={paths.de} />
      notFound()
    },
    switcher: (
      <LanguageSwitchRoute
        locale={locale}
        targets={{
          de: available.de ? paths.de : undefined,
          en: available.en ? paths.en : undefined,
        }}
      />
    ),
    metadata(metadata?: Metadata): Metadata {
      if (!available[locale]) {
        return {
          ...(locale === 'en' && available.de ? { title: cmsTranslationNoticeTitle } : {}),
          robots: { index: false, follow: false },
        }
      }

      return {
        ...createSiteMetadata({
          title: typeof metadata?.title === 'string' ? metadata.title : null,
          description: metadata?.description,
          path: canonical,
        }),
        alternates: {
          canonical,
          ...(available.de && available.en ? { languages: { ...paths, 'x-default': paths.de } } : {}),
        },
      }
    },
  }
}
