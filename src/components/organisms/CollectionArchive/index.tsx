import React from 'react'

import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'
import { Container } from '@/components/molecules/Container'

export type Props = {
  posts: Partial<BlogCardBaseProps>[]
}

/**
 * CollectionArchive Component
 *
 * Generic archive layout for displaying a collection of blog posts in a grid.
 * Uses BlogCard.Simple variant for consistent presentation.
 *
 * @deprecated Consider using BlogCard variants directly in page components for better flexibility
 */
export const CollectionArchive: React.FC<Props> = (props) => {
  const { posts } = props

  return (
    <Container>
      <div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-4 sm:grid-cols-8 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-8 xl:gap-x-8">
          {posts?.map((result, index) => {
            if (typeof result === 'object' && result !== null && result.title && result.href) {
              return (
                <div className="col-span-4" key={index}>
                  <BlogCard.Simple
                    title={result.title}
                    excerpt={result.excerpt}
                    href={result.href}
                    dateLabel={result.dateLabel || ''}
                    readTime={result.readTime || ''}
                    category={result.category}
                    image={result.image}
                    author={result.author}
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
