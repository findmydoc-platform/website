import clsx from 'clsx'
import React from 'react'
import RichText from '@/components/organisms/RichText'

import type { Post } from '@/payload-types'

import { PostCard } from '@/components/organisms/PostCard'
import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { Container } from '@/components/molecules/Container'

export type RelatedPostsProps = {
  className?: string
  docs?: Post[]
  introContent?: SerializedEditorState
}

export const RelatedPosts: React.FC<RelatedPostsProps> = (props) => {
  const { className, docs, introContent } = props

  return (
    <Container className={clsx(className)}>
      {introContent && <RichText data={introContent} enableGutter={false} />}

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-8">
        {docs?.map((doc, index) => {
          if (typeof doc === 'string') return null

          return <PostCard key={index} doc={doc} relationTo="posts" showCategories />
        })}
      </div>
    </Container>
  )
}
