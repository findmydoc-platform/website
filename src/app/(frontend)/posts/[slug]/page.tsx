import type { Metadata } from 'next'

import { RelatedPosts } from '@/blocks/RelatedPosts/Component'
import { PayloadRedirects } from '@/app/(frontend)/_components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'
import RichText from '@/blocks/_shared/RichText'

import type { Post } from '@/payload-types'

import { PostHero } from '@/components/organisms/Heroes/PostHero'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'
import { Container } from '@/components/molecules/Container'
import { formatAuthors } from '@/utilities/formatAuthors'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const params = posts.docs.map(({ slug }) => {
    return { slug }
  })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Post({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '' } = await paramsPromise
  const url = '/posts/' + slug
  const post = await queryPostBySlug({ slug })

  if (!post) return <PayloadRedirects url={url} />

  return (
    <article className="pt-16 pb-16">
      <PageClient />

      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <PostHero
        title={post.title}
        categories={post.categories?.map((c) => (typeof c === 'object' ? c.title || '' : '')).filter(Boolean)}
        authors={post.populatedAuthors ? formatAuthors(post.populatedAuthors) : undefined}
        publishedAt={post.publishedAt || undefined}
        image={
          post.heroImage && typeof post.heroImage === 'object' && post.heroImage.url
            ? {
                src: post.heroImage.url,
                alt: post.heroImage.alt || '',
                width: post.heroImage.width || undefined,
                height: post.heroImage.height || undefined,
              }
            : undefined
        }
      />

      <div className="flex flex-col items-center gap-4 pt-8">
        <Container>
          <RichText className="mx-auto max-w-3xl" data={post.content} enableGutter={false} />
          {post.relatedPosts && post.relatedPosts.length > 0 && (
            <RelatedPosts
              className="col-span-3 col-start-1 mt-12 max-w-4xl grid-rows-[2fr] lg:grid lg:grid-cols-subgrid"
              docs={post.relatedPosts.filter((post) => typeof post === 'object')}
            />
          )}
        </Container>
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  const post = await queryPostBySlug({ slug })

  return generateMeta({ doc: post })
}

const queryPostBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'posts',
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
