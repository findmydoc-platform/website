import type { Metadata } from 'next/types'

import React from 'react'
import PageClient from './page.client'
import { Container } from '@/components/molecules/Container'
import { BlogHero } from '@/components/organisms/Blog/BlogHero'
import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import { normalizeArchiveCard } from './archiveCards'
import { createBlogBreadcrumb, HOME_BREADCRUMB } from '@/utilities/breadcrumbs'
import { buildPostsIndexPath } from '@/utilities/content/postPaths'
import { getCachedPostArchivePage } from '@/utilities/content/serverData'
import { DEFAULT_CONTENT_LOCALE, resolveContentLocaleContext } from '@/utilities/contentLocalization'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { JsonLdScript, buildPostsIndexJsonLd } from '@/utilities/structuredData'
import { Heading } from '@/components/atoms/Heading'
import { PostsPagination } from './_components/PostsPagination'

export const revalidate = 600

const EMPTY_POSTS_COPY = {
  en: {
    title: 'New articles are on the way',
    description: 'We are preparing practical guidance about clinics, treatments, and informed comparisons.',
  },
  de: {
    title: 'Neue Beiträge sind in Vorbereitung',
    description: 'Wir bereiten praktische Orientierung zu Kliniken, Behandlungen und fundierten Vergleichen vor.',
  },
} as const

type Args = {
  searchParams?: Promise<{
    locale?: string | string[]
  }>
}

export default async function Page({ searchParams: searchParamsPromise }: Args = {}) {
  const searchParams = await searchParamsPromise
  const contentLocale = resolveContentLocaleContext(searchParams?.locale)

  const posts = await getCachedPostArchivePage({
    preferredLocale: contentLocale.locale ?? DEFAULT_CONTENT_LOCALE,
  })

  const normalizedPosts = posts.docs.map(normalizeArchiveCard)
  const [featuredPost, ...gridPosts] = normalizedPosts
  const moreArticlesCount = Math.max((posts.totalDocs || 0) - (featuredPost ? 1 : 0), 0)
  const breadcrumbs = [HOME_BREADCRUMB, createBlogBreadcrumb(buildPostsIndexPath(contentLocale))]
  const emptyCopy = contentLocale.locale === 'de' ? EMPTY_POSTS_COPY.de : EMPTY_POSTS_COPY.en

  return (
    <div className="pb-20 sm:pb-24" lang="en">
      <PageClient />
      <JsonLdScript
        data={buildPostsIndexJsonLd({
          breadcrumbs: [HOME_BREADCRUMB, createBlogBreadcrumb(buildPostsIndexPath())],
          posts: normalizedPosts,
        })}
      />

      {/* Hero Section */}
      <BlogHero breadcrumbs={breadcrumbs} />

      {normalizedPosts.length === 0 ? (
        <Container className="mt-6 mb-12 sm:mt-8 sm:mb-16">
          <section
            aria-labelledby="empty-posts-heading"
            lang={contentLocale.locale ?? DEFAULT_CONTENT_LOCALE}
            className="rounded-3xl border border-border bg-muted/30 px-5 py-10 text-center sm:px-8 sm:py-14"
          >
            <Heading id="empty-posts-heading" as="h2" size="h3" align="center">
              {emptyCopy.title}
            </Heading>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {emptyCopy.description}
            </p>
          </section>
        </Container>
      ) : null}

      {/* Featured Post (Overlay Variant) */}
      {featuredPost && (
        <Container className="mt-6 mb-12 sm:mt-8 sm:mb-16">
          <Heading as="h2" size="h3" align="left" className="mb-6">
            Latest Article
          </Heading>
          <div lang={featuredPost.locale}>
            <BlogCard.Overlay {...featuredPost} />
          </div>
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
              <div key={post.href} lang={post.locale} className="min-w-0">
                <BlogCard.Simple {...post} />
              </div>
            ))}
          </div>
        </Container>
      )}

      <Container>
        {posts.totalPages > 1 && posts.page && (
          <PostsPagination contentLocale={contentLocale} page={posts.page} totalPages={posts.totalPages} />
        )}
      </Container>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return createSiteMetadata({
    title: 'Our Blog - Health & Medicine',
    description: 'Explore expert insights and current topics across health, medicine, and patient care.',
    path: buildPostsIndexPath(),
  })
}
