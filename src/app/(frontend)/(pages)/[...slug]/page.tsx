import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { CmsTranslationUnavailable } from '@/app/(frontend)/_components/CmsTranslationUnavailable'
import { PayloadRedirects } from '@/app/(frontend)/_components/PayloadRedirects'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { generateMeta } from '@/utilities/generateMeta'
import { loadPageRoute } from '@/app/(frontend)/_data/loadPageRoute'
import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'
import { CmsLanguageSwitchRoute } from '@/features/languageSwitch/CmsLanguageSwitchRoute.client'
import { CMS_TRANSLATION_SOURCE_HEADER } from '@/utilities/routing/cmsRedirectRequest'
import { CmsDocumentLanguage } from '@/features/uiCopy/DocumentLanguage.client'

type Args = {
  params: Promise<{
    slug?: string[]
  }>
  searchParams: Promise<{
    locale?: string | string[]
  }>
}

async function loadRoute({ params, searchParams }: Args) {
  const [{ slug = ['home'] }, { locale }] = await Promise.all([params, searchParams])
  return loadPageRoute(slug, locale)
}

export default async function Page(args: Args) {
  const { route, draft, url } = await loadRoute(args)
  if (!route) {
    const germanPath =
      !draft && (url === '/en' || url.startsWith('/en/')) && (await headers()).get(CMS_TRANSLATION_SOURCE_HEADER)
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
  const { route, draft } = await loadRoute(args)
  if (!route) return { robots: { index: false, follow: false } }

  const metadata = await generateMeta({ doc: route.page, path: route.canonicalPath, sourceCollection: 'pages' })
  if (draft) return { ...metadata, robots: { index: false, follow: false } }
  if (!route.languagePaths) return metadata

  return {
    ...metadata,
    alternates: { canonical: route.canonicalPath, languages: route.languagePaths },
  }
}
