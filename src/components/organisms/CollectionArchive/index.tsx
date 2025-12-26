import React from 'react'

import { BlogCard, type BlogCardProps } from '@/components/organisms/BlogCard'
import { Container } from '@/components/molecules/Container'

export type Props = {
  posts: BlogCardProps[]
}

export const CollectionArchive: React.FC<Props> = (props) => {
  const { posts } = props

  return (
    <Container>
      <div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-4 sm:grid-cols-8 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-8 xl:gap-x-8">
          {posts?.map((result, index) => {
            if (typeof result === 'object' && result !== null) {
              return (
                <div className="col-span-4" key={index}>
                  {/* TODO: If CollectionArchive needs categories or
                      alternate metadata, adjust the adapter feeding
                      BlogCard rather than BlogCard itself. */}
                  <BlogCard
                    title={result.title}
                    excerpt={result.excerpt}
                    dateLabel={result.dateLabel}
                    image={result.image}
                  />
                </div>
              )
            }

            return null
          })}
        </div>
      </div>
    </Container>
  )
}
