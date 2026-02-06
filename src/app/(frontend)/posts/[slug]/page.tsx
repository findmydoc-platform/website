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
import { PostActionBar } from '@/components/molecules/PostActionBar'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'
import { Container } from '@/components/molecules/Container'
import { calculateReadTime } from '@/utilities/blog/calculateReadTime'
import { resolveMediaImage } from '@/utilities/media/resolveMediaImage'

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

  // Prepare enhanced PostHero props
  const firstCategory = post.categories?.[0]
  const categoryName = typeof firstCategory === 'object' ? firstCategory.title : undefined

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
    { label: 'Blog', href: '/posts' },
  ]
  if (categoryName) {
    breadcrumbs.push({ label: categoryName, href: `/posts?category=${categoryName}` })
  }
  const readTime = calculateReadTime(post.content)
    .replace('Min. Lesezeit', 'min read')
    .replace('< 1 min read', '1 min read')

  return (
    <article className="pb-16">
      <PageClient />

      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

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
      <PostActionBar backLink={{ label: 'Back to Blog', href: '/posts' }} shareButton={{ label: 'Share', url: url }} />

      <div className="py-10 md:py-12">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-8 lg:col-start-3">
              <RichText
                className="text-muted-foreground [&.prose]:max-w-none"
                data={post.content}
                enableGutter={false}
              />
              {post.relatedPosts && post.relatedPosts.length > 0 && (
                <RelatedPosts className="mt-12" docs={post.relatedPosts.filter((post) => typeof post === 'object')} />
              )}
            </div>
          </div>
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
