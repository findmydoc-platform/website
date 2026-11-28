import clsx from 'clsx'
import React from 'react'
import RichText from '@/blocks/_shared/RichText'

import type { Post } from '@/payload-types'
import type { ContentLocaleContext } from '@/utilities/contentLocalization'

import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { formatDate } from '@/utilities/blog/formatDate'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

type RelatedPostDoc = Partial<Post> & Pick<Post, 'title' | 'slug'>

export type RelatedPostsProps = {
  className?: string
  contentLocale?: ContentLocaleContext
  docs?: RelatedPostDoc[]
  dateLocale?: ContentLocale
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
  const { className, contentLocale, dateLocale, docs, introContent } = props

  return (
    <div className={clsx(className)}>
      {introContent && <RichText contentLocale={contentLocale} data={introContent} enableGutter={false} />}

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-8">
        {docs?.map((doc) => {
          if (typeof doc === 'string') return null

          // Normalize Payload Post to presentational props
          const postProps = normalizePost(doc, { contentLocale })

          return (
            <BlogCard.Overview
              key={postProps.href}
              {...postProps}
              dateLabel={dateLocale && doc.publishedAt ? formatDate(doc.publishedAt, dateLocale) : postProps.dateLabel}
              dateLang={dateLocale ?? postProps.dateLang}
              readTimeLang="en"
            />
          )
        })}
      </div>
    </div>
  )
}
