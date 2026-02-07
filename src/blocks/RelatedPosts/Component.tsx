import clsx from 'clsx'
import React from 'react'
import RichText from '@/blocks/_shared/RichText'

import type { Post } from '@/payload-types'

import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

export type RelatedPostsProps = {
  className?: string
  docs?: Post[]
  introContent?: SerializedEditorState
}

/**
 * RelatedPosts Block Component
 *
 * Displays a grid of related blog posts below the main post content.
 * Uses BlogCard.Overview variant (compact 16:10 aspect ratio cards).
 *
 * Features:
 * - Grid layout (2 columns on desktop)
 * - Category pills below images
 * - Date and read time with icons
 * - Normalized post data from Payload
 */
export const RelatedPosts: React.FC<RelatedPostsProps> = (props) => {
  const { className, docs, introContent } = props

  return (
    <div className={clsx(className)}>
      {introContent && <RichText data={introContent} enableGutter={false} />}

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-8">
        {docs?.map((doc, index) => {
          if (typeof doc === 'string') return null

          // Normalize Payload Post to presentational props
          const postProps = normalizePost(doc)

          return <BlogCard.Overview key={index} {...postProps} />
        })}
      </div>
    </div>
  )
}
