import type { Post, ArchiveBlock as ArchiveBlockProps, PlatformContentMedia } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import RichText from '@/blocks/_shared/RichText'

import { CollectionArchive } from '@/components/organisms/CollectionArchive'
import { Container } from '@/components/molecules/Container'
import type { BlogCardProps } from '@/components/organisms/Blog/BlogCard'

export const ArchiveBlock: React.FC<
  ArchiveBlockProps & {
    id?: string
  }
> = async (props) => {
  const { id, categories, introContent, limit: limitFromProps, populateBy, selectedDocs } = props

  const limit = limitFromProps || 3

  let posts: Post[] = []

  if (populateBy === 'collection') {
    const payload = await getPayload({ config: configPromise })

    const flattenedCategories = categories?.map((category) => {
      if (typeof category === 'object') return category.id
      else return category
    })

    const fetchedPosts = await payload.find({
      collection: 'posts',
      depth: 1,
      limit,
      ...(flattenedCategories && flattenedCategories.length > 0
        ? {
            where: {
              categories: {
                in: flattenedCategories,
              },
            },
          }
        : {}),
    })

    posts = fetchedPosts.docs
  } else {
    if (selectedDocs?.length) {
      const filteredSelectedPosts = selectedDocs.map((post) => {
        if (typeof post.value === 'object') return post.value
      }) as Post[]

      posts = filteredSelectedPosts
    }
  }

  const formattedPosts: BlogCardProps[] = posts.map((post) => {
    const { title, meta } = post
    const image = meta?.image as PlatformContentMedia | null

    // TODO: Keep BlogCard visual design in sync if Archive block
    // needs categories, alternate description field, or CTA in future.

    return {
      title,
      excerpt: meta?.description || undefined,
      dateLabel: undefined,
      image:
        image && typeof image === 'object' && image.url
          ? {
              src: image.url,
              alt: image.alt || '',
            }
          : undefined,
    }
  })

  return (
    <div className="my-16" id={`block-${id}`}>
      {introContent && (
        <Container className="mb-16">
          <RichText className="ml-0 max-w-3xl" data={introContent} enableGutter={false} />
        </Container>
      )}
      <CollectionArchive posts={formattedPosts} />
    </div>
  )
}
