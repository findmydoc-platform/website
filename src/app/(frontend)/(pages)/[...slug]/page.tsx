import type { Metadata } from 'next'

import { PayloadRedirects } from '@/app/(frontend)/_components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { generateMeta } from '@/utilities/generateMeta'
import { findPageBySlug, findPublicPageRoute } from '@/utilities/content/serverData'
import { buildPagePath } from '@/utilities/cachePolicy'
import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'
import type { ContentLocale } from '@/utilities/contentLocalization'

type Args = {
  params: Promise<{
    slug?: string[]
  }>
  searchParams: Promise<{
    locale?: string | string[]
  }>
}

const queryPage = cache(async (slug: string, locale: ContentLocale, draft: boolean) => {
  const payload = await getPayload({ config: configPromise })
  if (!draft) return findPublicPageRoute(payload, slug, locale)

  const page = await findPageBySlug(payload, slug, true, { locale, fallbackLocale: false })
  return page ? { page, locale, canonicalPath: buildPagePath(slug, locale), languagePaths: undefined } : null
})

async function loadRoute({ params, searchParams }: Args) {
  const [{ isEnabled: draft }, { slug: pathSegments = ['home'] }] = await Promise.all([draftMode(), params])
  const isEnglishPath = pathSegments[0] === 'en'
  const slugSegments = isEnglishPath ? pathSegments.slice(1) : pathSegments
  const previewLocale = draft ? (await searchParams).locale : undefined
  const locale = previewLocale === 'de' || previewLocale === 'en' ? previewLocale : isEnglishPath ? 'en' : 'de'
  const url = '/' + pathSegments.join('/')
  const route = await queryPage(slugSegments.join('/') || 'home', locale, draft)
  return { route, draft, url }
}

export default async function Page(args: Args) {
  const { route, draft, url } = await loadRoute(args)
  if (!route) return <PayloadRedirects url={url} />

  return (
    <article className="pt-12 pb-20 sm:pt-16 sm:pb-24" lang={route.locale}>
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
