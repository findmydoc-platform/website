import clsx from 'clsx'
import React from 'react'
import RichText from '@/blocks/_shared/RichText'

import type { Post, PlatformContentMedia } from '@/payload-types'

import { BlogCard } from '@/components/organisms/BlogCard'
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

          const { title, meta } = doc
          const image = meta?.image as PlatformContentMedia | null

          // TODO: If RelatedPosts needs categories or a different
          // layout than BlogCard, extend this adapter and BlogCard
          // props without changing the core BlogCard design.

          const imageProps =
            image && typeof image === 'object' && image.url
              ? {
                  src: image.url,
                  alt: image.alt || '',
                }
              : undefined

          return (
            <BlogCard
              key={index}
              title={title}
              excerpt={meta?.description || undefined}
              dateLabel={undefined}
              image={imageProps}
            />
          )
        })}
      </div>
    </div>
  )
}
