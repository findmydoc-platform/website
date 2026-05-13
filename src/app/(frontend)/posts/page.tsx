import type { Metadata } from 'next/types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import { Container } from '@/components/molecules/Container'
import { BlogHero } from '@/components/organisms/Blog/BlogHero'
import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { buildPostsIndexPath, buildPostsPagePath } from '@/utilities/content/postPaths'
import { findPublishedPostsPage } from '@/utilities/content/serverData'
import { resolveContentLocaleContext } from '@/utilities/contentLocalization'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { Heading } from '@/components/atoms/Heading'
import { PostsPagination } from './_components/PostsPagination'

export const dynamic = 'force-static'
export const revalidate = 600

type Args = {
  searchParams?: Promise<{
    locale?: string | string[]
  }>
}

export default async function Page({ searchParams: searchParamsPromise }: Args = {}) {
  const payload = await getPayload({ config: configPromise })
  const searchParams = await searchParamsPromise
  const contentLocale = resolveContentLocaleContext(searchParams?.locale)

  const posts = await findPublishedPostsPage(payload, {
    contentLocale,
    limit: 12,
  })

  const normalizedPosts = posts.docs.map((post) => normalizePost(post, { contentLocale }))
  const [featuredPost, ...gridPosts] = normalizedPosts
  const moreArticlesCount = Math.max((posts.totalDocs || 0) - (featuredPost ? 1 : 0), 0)

  return (
    <div className="pb-20 sm:pb-24">
      <PageClient />

      {/* Hero Section */}
      <BlogHero />

      {/* Featured Post (Overlay Variant) */}
      {featuredPost && (
        <Container className="mt-6 mb-12 sm:mt-8 sm:mb-16">
          <Heading as="h2" size="h3" align="left" className="mb-6">
            Latest Article
          </Heading>
          <BlogCard.Overlay {...featuredPost} />
        </Container>
      )}

      {/* Grid Posts (Simple Variant) */}
      {gridPosts.length > 0 && (
        <Container className="mb-12 sm:mb-16">
          <div className="mb-6">
            <Heading as="h3" size="h4" align="left">
              More Articles
            </Heading>
            <p className="mt-1 text-sm text-muted-foreground">
              {moreArticlesCount} more {moreArticlesCount === 1 ? 'article' : 'articles'}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 md:gap-8 xl:grid-cols-3">
            {gridPosts.map((post) => (
              <BlogCard.Simple key={post.href} {...post} />
            ))}
          </div>
        </Container>
      )}

      <Container>
        {posts.totalPages > 1 && posts.page && (
          <PostsPagination
            getPathForPage={(page) => buildPostsPagePath(page, contentLocale)}
            page={posts.page}
            totalPages={posts.totalPages}
          />
        )}
      </Container>
    </div>
  )
}

export async function generateMetadata({ searchParams: searchParamsPromise }: Args = {}): Promise<Metadata> {
  const searchParams = await searchParamsPromise
  const contentLocale = resolveContentLocaleContext(searchParams?.locale)

  return createSiteMetadata({
    title: 'Our Blog - Health & Medicine',
    description: 'Explore expert insights and current topics across health, medicine, and patient care.',
    path: buildPostsIndexPath(contentLocale),
  })
}
