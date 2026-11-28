import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import {
  CmsTranslationUnavailable,
  cmsTranslationNoticeTitle,
} from '@/app/(frontend)/_components/CmsTranslationUnavailable'
import { PayloadRedirects } from '@/app/(frontend)/_components/PayloadRedirects'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { generateMeta } from '@/utilities/generateMeta'
import { findPublicCmsCanonicalBySlug } from '@/app/(frontend)/_data/resolveRedirectTargetPath'
import { parseCmsRedirectPath } from '@/utilities/content/cmsRedirectPaths'
import { loadPageRoute } from '@/app/(frontend)/_data/loadPageRoute'
import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'
import { CmsLanguageSwitchRoute } from '@/features/languageSwitch/CmsLanguageSwitchRoute.client'
import { CMS_TRANSLATION_SOURCE_HEADER } from '@/utilities/routing/cmsRedirectRequest'
import { CmsDocumentLanguage } from '@/features/uiCopy/DocumentLanguage.client'
import {
  isTemporaryLandingModeRequest,
  readTemporaryLandingLocale,
  TEMPORARY_LANDING_PATHS,
} from '@/features/temporaryLandingMode'
import { getManagedLegalPageSlugFromPath } from '@/utilities/legalPages'
import { generateHoldingHomeMetadata, renderHoldingHome, type HoldingHomeSearchParams } from '../../_data/holdingHome'

type Args = {
  params: Promise<{
    slug?: string[]
  }>
  searchParams: Promise<HoldingHomeSearchParams>
}

const isTurkishHoldingHome = (slug?: string[]) => slug?.length === 1 && '/' + slug[0] === TEMPORARY_LANDING_PATHS.tr

async function findGermanPageSource(url: string, requestHeaders: Headers) {
  const proxySource = requestHeaders.get(CMS_TRANSLATION_SOURCE_HEADER)
  if (proxySource) return proxySource
  if (url === '/en') return '/'

  const source = parseCmsRedirectPath(url)
  if (source?.collection !== 'pages' || source.locale !== 'en') return null
  const germanPage = await findPublicCmsCanonicalBySlug({ ...source, locale: 'de' })
  return germanPage?.path ?? null
}

async function loadRoute({ params, searchParams }: Args, requestHeaders: Headers) {
  const [{ slug = ['home'] }, { locale }] = await Promise.all([params, searchParams])
  const result = await loadPageRoute(slug, locale)
  const { route, draft, url } = result
  const holdingLegal = isTemporaryLandingModeRequest(requestHeaders) && Boolean(getManagedLegalPageSlugFromPath(url))
  const germanPath =
    !holdingLegal && !route && !draft && (url === '/en' || url.startsWith('/en/'))
      ? await findGermanPageSource(url, requestHeaders)
      : null
  return { ...result, germanPath, holdingLegal }
}

export default async function Page(args: Args) {
  const requestHeaders = await headers()
  const holdingLocale = readTemporaryLandingLocale(requestHeaders)
  if (holdingLocale) return renderHoldingHome(holdingLocale, await args.searchParams)
  if (isTurkishHoldingHome((await args.params).slug)) notFound()

  const { route, draft, url, germanPath, holdingLegal } = await loadRoute(args, requestHeaders)
  if (!route) {
    if (holdingLegal) notFound()
    return germanPath ? <CmsTranslationUnavailable germanPath={germanPath} /> : <PayloadRedirects url={url} />
  }

  return (
    <article className="pt-12 pb-20 sm:pt-16 sm:pb-24" lang={route.locale}>
      <CmsDocumentLanguage locale={route.locale} />
      {!draft && (
        <CmsLanguageSwitchRoute
          locale={route.locale}
          targets={route.languagePaths ?? { [route.locale]: route.canonicalPath }}
        />
      )}
      <PayloadRedirects disableNotFound url={url} />
      {draft && <LivePreviewListener />}
      <RenderBlocks blocks={route.page.layout} contentLocale={{ locale: route.locale, fallbackLocale: false }} />
    </article>
  )
}

export async function generateMetadata(args: Args): Promise<Metadata> {
  const requestHeaders = await headers()
  const holdingLocale = readTemporaryLandingLocale(requestHeaders)
  if (holdingLocale) return generateHoldingHomeMetadata(holdingLocale)
  if (isTurkishHoldingHome((await args.params).slug)) return { robots: { index: false, follow: false } }

  const { route, draft, germanPath, holdingLegal } = await loadRoute(args, requestHeaders)
  if (!route) {
    return {
      robots: { index: false, follow: false },
      ...(germanPath ? { title: cmsTranslationNoticeTitle } : {}),
    }
  }

  const metadata = await generateMeta({ doc: route.page, path: route.canonicalPath, sourceCollection: 'pages' })
  if (draft || holdingLegal) return { ...metadata, robots: { index: false, follow: false } }
  if (!route.languagePaths) return metadata

  return {
    ...metadata,
    alternates: { canonical: route.canonicalPath, languages: route.languagePaths },
  }
}
