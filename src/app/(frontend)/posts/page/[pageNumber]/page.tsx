import type { Metadata } from 'next/types'

import { Simple as BlogCard } from '@/components/organisms/Blog/BlogCard/Simple'
import React from 'react'
import PageClient from './page.client'
import { Breadcrumb, type BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { Heading } from '@/components/atoms/Heading'
import { notFound, redirect } from 'next/navigation'
import { Container } from '@/components/molecules/Container'
import { normalizeArchiveCard } from '../../archiveCards'
import { createBlogBreadcrumb, HOME_BREADCRUMB } from '@/utilities/breadcrumbs'
import { buildPostsIndexPath, buildPostsPagePath } from '@/utilities/content/postPaths'
import { getCachedPostArchivePage } from '@/utilities/content/serverData'
import { DEFAULT_CONTENT_LOCALE, resolveContentLocaleContext } from '@/utilities/contentLocalization'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { JsonLdScript, buildPostsIndexJsonLd } from '@/utilities/structuredData'
import { PostsPagination } from '../../_components/PostsPagination'

export const revalidate = 600

type Args = {
  params: Promise<{
    pageNumber: string
  }>
  searchParams: Promise<{
    locale?: string | string[]
  }>
}

export default async function Page({ params: paramsPromise, searchParams: searchParamsPromise }: Args) {
  const { pageNumber } = await paramsPromise
  const searchParams = await searchParamsPromise
  const contentLocale = resolveContentLocaleContext(searchParams.locale)

  if (!/^\d+$/.test(pageNumber)) notFound()

  const sanitizedPageNumber = Number.parseInt(pageNumber, 10)

  if (!Number.isSafeInteger(sanitizedPageNumber) || sanitizedPageNumber < 1) notFound()
  if (sanitizedPageNumber === 1) redirect(buildPostsIndexPath(contentLocale))

  const posts = await getCachedPostArchivePage({
    preferredLocale: contentLocale.locale ?? DEFAULT_CONTENT_LOCALE,
    page: sanitizedPageNumber,
  })

  if (!posts.docs.length || sanitizedPageNumber > posts.totalPages) notFound()

  const normalizedPosts = posts.docs.map(normalizeArchiveCard)
  const remainingArticlesCount = Math.max((posts.totalDocs || 0) - 1, 0)
  const pagePath = buildPostsPagePath(sanitizedPageNumber, contentLocale)
  const breadcrumbs: BreadcrumbItem[] = [
    HOME_BREADCRUMB,
    createBlogBreadcrumb(buildPostsIndexPath(contentLocale)),
    { label: `Page ${sanitizedPageNumber}`, href: pagePath },
  ]

  return (
    <div className="pt-16 pb-20 sm:pt-24 sm:pb-24" lang="en">
      <PageClient />
      <JsonLdScript
        data={buildPostsIndexJsonLd({
          breadcrumbs: [
            HOME_BREADCRUMB,
            createBlogBreadcrumb(buildPostsIndexPath()),
            { label: `Page ${sanitizedPageNumber}`, href: buildPostsPagePath(sanitizedPageNumber) },
          ],
          posts: normalizedPosts,
        })}
      />
      <Container className="mb-12 sm:mb-16">
        <div className="prose max-w-none">
          <Breadcrumb items={breadcrumbs} className="mb-6 [&_ol]:justify-center" />
          <Heading as="h1" align="center">
            Posts
          </Heading>
        </div>
      </Container>

      <Container className="mb-6 sm:mb-8">
        <Heading as="h2" size="h3" align="left">
          More Articles
        </Heading>
        <p className="mt-1 text-sm text-muted-foreground">
          {remainingArticlesCount} more {remainingArticlesCount === 1 ? 'article' : 'articles'}
        </p>
      </Container>

      <Container>
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-8 lg:grid-cols-12 lg:gap-8">
          {normalizedPosts.map((post) => (
            <div key={post.href} lang={post.locale} className="col-span-4 min-w-0">
              <BlogCard {...post} />
            </div>
          ))}
        </div>
      </Container>

      <Container>
        {posts?.page && posts?.totalPages > 1 && (
          <PostsPagination contentLocale={contentLocale} page={posts.page} totalPages={posts.totalPages} />
        )}
      </Container>
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { pageNumber } = await paramsPromise
  const metadataPath = /^\d+$/.test(pageNumber) ? buildPostsPagePath(Number(pageNumber)) : `/posts/page/${pageNumber}`

  return createSiteMetadata({
    title: `Posts Page ${pageNumber || ''}`,
    path: metadataPath,
  })
}
