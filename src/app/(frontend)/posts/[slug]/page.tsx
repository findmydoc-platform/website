import type { Metadata } from 'next'

import { RelatedPosts } from '@/blocks/RelatedPosts/Component'
import { PayloadRedirects } from '@/app/(frontend)/_components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'
import RichText from '@/blocks/_shared/RichText'

import { PostHero } from '@/components/organisms/Heroes/PostHero'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'
import { Container } from '@/components/molecules/Container'
import { calculateReadTime } from '@/utilities/blog/calculateReadTime'
import { findPostBySlug, findPostSlugs } from '@/utilities/content/serverData'
import { resolveMediaImage } from '@/utilities/media/resolveMediaImage'
import { PostShareActionBar } from './PostShareActionBar'
import { resolveContentLocaleContext, type ContentLocaleContext } from '@/utilities/contentLocalization'
import { buildPostPath, buildPostsIndexPath } from '@/utilities/content/postPaths'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const posts = await findPostSlugs(payload)

  const params = posts.map(({ slug }) => {
    return { slug }
  })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
  }>
  searchParams: Promise<{
    locale?: string | string[]
  }>
}

export default async function Post({ params: paramsPromise, searchParams: searchParamsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '' } = await paramsPromise
  const searchParams = await searchParamsPromise
  const contentLocale = resolveContentLocaleContext(searchParams.locale)
  const canonicalPostPath = buildPostPath(slug)
  const localizedPostPath = buildPostPath(slug, contentLocale)
  const post = await queryPostBySlug({ contentLocale, slug })

  if (!post) return <PayloadRedirects url={canonicalPostPath} />

  const firstAuthor = post.populatedAuthors?.[0]
  const authorData =
    firstAuthor && typeof firstAuthor === 'object'
      ? {
          name: firstAuthor.name || 'Unknown',
          avatar: firstAuthor.avatar || undefined,
          role: undefined,
        }
      : undefined

  const heroImage =
    post.heroImage && typeof post.heroImage === 'object' ? resolveMediaImage(post.heroImage, post.title) : undefined

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Blog', href: buildPostsIndexPath(contentLocale) },
  ]
  const readTime = calculateReadTime(post.content)

  return (
    <article className="pb-16 sm:pb-20">
      <PageClient />

      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={canonicalPostPath} />

      {draft && <LivePreviewListener />}

      <PostHero
        title={post.title}
        excerpt={post.excerpt || undefined}
        categories={post.categories?.map((c) => (typeof c === 'object' ? c.title || '' : '')).filter(Boolean)}
        author={authorData}
        publishedAt={post.publishedAt || undefined}
        readTime={readTime}
        breadcrumbs={breadcrumbs}
        image={heroImage}
      />

      {/* Action Bar - Back Link & Share Button */}
      <PostShareActionBar
        backLink={{ label: 'Back to Blog', href: buildPostsIndexPath(contentLocale) }}
        shareUrl={localizedPostPath}
        shareTitle={post.title}
        shareDescription={post.excerpt || undefined}
      />

      <div className="py-8 sm:py-10 md:py-12">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-8 lg:col-start-3">
              <RichText
                className="text-muted-foreground [&.prose]:max-w-none"
                contentLocale={contentLocale}
                data={post.content}
                enableGutter={false}
              />
              {post.relatedPosts && post.relatedPosts.length > 0 && (
                <RelatedPosts
                  className="mt-10 sm:mt-12"
                  contentLocale={contentLocale}
                  docs={post.relatedPosts.filter((post) => typeof post === 'object')}
                />
              )}
            </div>
          </div>
        </Container>
      </div>
    </article>
  )
}

export async function generateMetadata({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  const searchParams = await searchParamsPromise
  const contentLocale = resolveContentLocaleContext(searchParams.locale)
  const post = await queryPostBySlug({ contentLocale, slug })

  return generateMeta({ doc: post })
}

const queryPostBySlug = cache(
  async ({ slug, contentLocale }: { contentLocale?: ContentLocaleContext; slug: string }) => {
    const normalizedContentLocale = contentLocale ?? {}

    const { isEnabled: draft } = await draftMode()

    const payload = await getPayload({ config: configPromise })

    return findPostBySlug(payload, slug, draft, normalizedContentLocale)
  },
)
