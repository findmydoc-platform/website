import type { Post, ArchiveBlock as ArchiveBlockProps } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import RichText from '@/blocks/_shared/RichText'

import { CollectionArchive } from '@/components/organisms/CollectionArchive'
import { Container } from '@/components/molecules/Container'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { findPublishedPostsPage } from '@/utilities/content/serverData'

type ArchivePost = Partial<Post> & Pick<Post, 'title' | 'slug'>

export const ArchiveBlock: React.FC<
  ArchiveBlockProps & {
    id?: string
  }
> = async (props) => {
  const { id, categories, introContent, limit: limitFromProps, populateBy, selectedDocs } = props

  const limit = limitFromProps ?? 10

  let posts: ArchivePost[] = []

  if (populateBy === 'collection') {
    const payload = await getPayload({ config: configPromise })

    const flattenedCategories = categories?.map((category) => {
      if (typeof category === 'object') return category.id
      else return category
    })

    const fetchedPosts = await findPublishedPostsPage(payload, {
      limit,
      pagination: false,
      where:
        flattenedCategories && flattenedCategories.length > 0
          ? {
              categories: {
                in: flattenedCategories,
              },
            }
          : undefined,
    })

    posts = fetchedPosts.docs as ArchivePost[]
  } else {
    if (selectedDocs?.length) {
      const selectedValues = selectedDocs.map((post) => post.value)
      const selectedObjects = selectedValues.filter(
        (value): value is Post => typeof value === 'object' && value !== null,
      )
      const selectedIds = selectedValues
        .map((value) => (typeof value === 'object' && value !== null ? value.id : value))
        .filter((value): value is number => typeof value === 'number')

      if (selectedIds.length === 0) {
        posts = selectedObjects
      } else {
        const payload = await getPayload({ config: configPromise })
        const fetchedPosts = await findPublishedPostsPage(payload, {
          limit: selectedIds.length,
          pagination: false,
          where: {
            id: {
              in: selectedIds,
            },
          },
        })
        const fetchedMap = new Map(fetchedPosts.docs.map((doc) => [doc.id, doc]))
        posts = selectedValues
          .map((value) => {
            if (typeof value === 'object' && value !== null) return value
            if (typeof value === 'number') return fetchedMap.get(value)
            return null
          })
          .filter((value): value is Post => Boolean(value))
      }
    }
  }

  // Normalize posts to presentational props
  const formattedPosts = posts.map(normalizePost)

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
