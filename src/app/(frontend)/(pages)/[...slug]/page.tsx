import type { Metadata } from 'next'

import { PayloadRedirects } from '@/app/(frontend)/_components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { generateMeta } from '@/utilities/generateMeta'
import { findPageBySlug, findPageSlugs, type PageDetailDoc } from '@/utilities/content/serverData'
import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const pages = await findPageSlugs(payload)

  const params = pages
    ?.filter((doc) => {
      return doc.slug && doc.slug !== 'home'
    })
    .map(({ slug }) => {
      return { slug: slug!.split('/') }
    })

  return params
}

type Args = {
  params: Promise<{
    slug?: string[]
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = ['home'] } = await paramsPromise
  const url = '/' + slug.join('/')

  const page: PageDetailDoc | null = await queryPageBySlug({
    slug: slug.join('/'),
  })

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { layout } = page

  return (
    <article className="pt-12 pb-20 sm:pt-16 sm:pb-24">
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <RenderBlocks blocks={layout} />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = ['home'] } = await paramsPromise
  const page = await queryPageBySlug({
    slug: slug.join('/'),
  })

  return generateMeta({ doc: page })
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  return findPageBySlug(payload, slug, draft)
})
