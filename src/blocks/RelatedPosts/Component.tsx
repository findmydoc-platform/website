import clsx from 'clsx'
import React from 'react'
import RichText from '@/components/organisms/RichText'

import type { Post } from '@/payload-types'

import { PostCard } from '@/components/organisms/PostCard'
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

          return (
            <PostCard.Root key={index} doc={doc} relationTo="posts">
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
