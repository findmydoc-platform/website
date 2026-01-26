import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/organisms/CollectionArchive'
import { PageRange } from '@/components/molecules/PageRange'
import { Pagination } from '@/components/molecules/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import { notFound } from 'next/navigation'
import { Container } from '@/components/molecules/Container'
import { mapPostToCardData } from '@/utilities/mapPostToCardData'

export const revalidate = 600

type Args = {
  params: Promise<{
    pageNumber: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { pageNumber } = await paramsPromise
  const payload = await getPayload({ config: configPromise })

  const sanitizedPageNumber = Number(pageNumber)

  if (!Number.isInteger(sanitizedPageNumber)) notFound()

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    page: sanitizedPageNumber,
    overrideAccess: false,
  })

  return (
    <div className="pt-24 pb-24">
      <PageClient />
      <Container className="mb-16">
        <div className="prose max-w-none">
          <h1>Posts</h1>
        </div>
      </Container>

      <Container className="mb-8">
        <PageRange collection="posts" currentPage={posts.page} limit={12} totalDocs={posts.totalDocs} />
      </Container>

      <CollectionArchive posts={posts.docs.map(mapPostToCardData)} />

      <Container>
        {posts?.page && posts?.totalPages > 1 && <Pagination page={posts.page} totalPages={posts.totalPages} />}
      </Container>
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { pageNumber } = await paramsPromise
  return {
    title: `findmydoc Posts Page ${pageNumber || ''}`,
  }
}

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const { totalDocs } = await payload.count({
    collection: 'posts',
    overrideAccess: false,
  })

  const totalPages = Math.ceil(totalDocs / 10)

  const pages: { pageNumber: string }[] = []

  for (let i = 1; i <= totalPages; i++) {
    pages.push({ pageNumber: String(i) })
  }

  return pages
}
