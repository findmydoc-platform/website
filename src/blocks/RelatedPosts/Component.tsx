import clsx from 'clsx'
import React from 'react'
import RichText from '@/blocks/_shared/RichText'

import type { Post, PlatformContentMedia } from '@/payload-types'

import { PostCard, PostCardData } from '@/components/organisms/PostCard'
import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

export type RelatedPostsProps = {
  className?: string
  docs?: Post[]
  introContent?: SerializedEditorState
}

export const RelatedPosts: React.FC<RelatedPostsProps> = (props) => {
  const { className, docs, introContent } = props

  return (
    <div className={clsx(className)}>
      {introContent && <RichText data={introContent} enableGutter={false} />}

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-8">
        {docs?.map((doc, index) => {
          if (typeof doc === 'string') return null

          const { slug, title, meta, categories } = doc
          const href = `/posts/${slug}`
          const image = meta?.image as PlatformContentMedia | null

          const postCardData: PostCardData = {
            title,
            href,
            description: meta?.description || undefined,
            image:
              image && typeof image === 'object' && image.url
                ? {
                    src: image.url,
                    alt: image.alt || '',
                    width: image.width || undefined,
                    height: image.height || undefined,
                  }
                : undefined,
            categories: categories
              ?.map((cat) => {
                if (typeof cat === 'object') return cat.title || ''
                return ''
              })
              .filter(Boolean),
          }

          return (
            <PostCard.Root key={index} data={postCardData}>
              <PostCard.Media />
              <PostCard.Content>
                <PostCard.Categories />
                <PostCard.Title />
                <PostCard.Description />
              </PostCard.Content>
            </PostCard.Root>
          )
        })}
      </div>
    </div>
  )
}
