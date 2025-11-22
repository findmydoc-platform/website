import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function Page() {
  const payload = await getPayload({ config: configPromise })

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      categories: true,
      meta: true,
    },
  })

  return (
    <div className="pb-24 pt-24">
      <PageClient />
      <div className="page-shell mb-16">
        <div className="prose max-w-none">
          <h1>Posts</h1>
        </div>
      </div>

      <div className="page-shell mb-8">
        <PageRange collection="posts" currentPage={posts.page} limit={12} totalDocs={posts.totalDocs} />
      </div>

      <CollectionArchive posts={posts.docs} />

      <div className="page-shell">
        {posts.totalPages > 1 && posts.page && <Pagination page={posts.page} totalPages={posts.totalPages} />}
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'findmydoc Posts',
  }
}
