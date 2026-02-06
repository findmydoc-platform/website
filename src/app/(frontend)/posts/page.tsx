import type { Metadata } from 'next/types'

import { PageRange } from '@/components/molecules/PageRange'
import { Pagination } from '@/components/molecules/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import { Container } from '@/components/molecules/Container'
import { BlogHero } from '@/components/organisms/Blog/BlogHero'
import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import { normalizePost } from '@/utilities/blog/normalizePost'

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
      excerpt: true,
      content: true,
      categories: true,
      populatedAuthors: true,
      publishedAt: true,
      heroImage: true,
      meta: {
        image: true,
        description: true,
      },
    },
  })

  const normalizedPosts = posts.docs.map(normalizePost)
  const [featuredPost, ...gridPosts] = normalizedPosts

  return (
    <div className="pb-24">
      <PageClient />

      {/* Hero Section */}
      <BlogHero />

      <Container className="mt-16 mb-8">
        <PageRange collection="posts" currentPage={posts.page} limit={12} totalDocs={posts.totalDocs} />
      </Container>

      {/* Featured Post (Overlay Variant) */}
      {featuredPost && (
        <Container className="mb-16">
          <BlogCard.Overlay {...featuredPost} />
        </Container>
      )}

      {/* Grid Posts (Simple Variant) */}
      {gridPosts.length > 0 && (
        <Container className="mb-16">
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {gridPosts.map((post) => (
              <BlogCard.Simple key={post.href} {...post} />
            ))}
          </div>
        </Container>
      )}

      <Container>
        {posts.totalPages > 1 && posts.page && <Pagination page={posts.page} totalPages={posts.totalPages} />}
      </Container>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Our Blog - Health & Medicine | findmydoc',
    description: 'Explore expert insights and current topics across health, medicine, and patient care.',
  }
}
