import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/organisms/CollectionArchive'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import { Heading } from '@/components/atoms/Heading'
import { notFound, redirect } from 'next/navigation'
import { Container } from '@/components/molecules/Container'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { buildPostsIndexPath, buildPostsPagePath } from '@/utilities/content/postPaths'
import { countPublishedPosts, findPublishedPostsPage } from '@/utilities/content/serverData'
import { resolveContentLocaleContext } from '@/utilities/contentLocalization'
import { PostsPagination } from '../../_components/PostsPagination'

export const revalidate = 600
const POSTS_PER_PAGE = 12

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

  const payload = await getPayload({ config: configPromise })

  const posts = await findPublishedPostsPage(payload, {
    contentLocale,
    limit: POSTS_PER_PAGE,
    page: sanitizedPageNumber,
  })

  if (!posts.docs.length || sanitizedPageNumber > posts.totalPages) notFound()

  const normalizedPosts = posts.docs.map((post) => normalizePost(post, { contentLocale }))
  const remainingArticlesCount = Math.max((posts.totalDocs || 0) - 1, 0)

  return (
    <div className="pt-16 pb-20 sm:pt-24 sm:pb-24">
      <PageClient />
      <Container className="mb-12 sm:mb-16">
        <div className="prose max-w-none">
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

      <CollectionArchive posts={normalizedPosts} />

      <Container>
        {posts?.page && posts?.totalPages > 1 && (
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

export async function generateMetadata({ params: paramsPromise }: Pick<Args, 'params'>): Promise<Metadata> {
  const { pageNumber } = await paramsPromise
  return {
    title: `findmydoc Posts Page ${pageNumber || ''}`,
  }
}

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const totalDocs = await countPublishedPosts(payload)

  const totalPages = Math.ceil(totalDocs / POSTS_PER_PAGE)

  const pages: { pageNumber: string }[] = []

  for (let i = 2; i <= totalPages; i++) {
    pages.push({ pageNumber: String(i) })
  }

  return pages
}
