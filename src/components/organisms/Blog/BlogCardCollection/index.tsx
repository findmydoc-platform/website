import React from 'react'

import { BlogCard, type BlogCardProps } from '@/components/organisms/Blog/BlogCard'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export type BlogCardCollectionProps = {
  posts: BlogCardProps[]
  className?: string
  variant?: 'default' | 'blue'
}

export const BlogCardCollection: React.FC<BlogCardCollectionProps> = ({
  posts = [],
  className,
  variant = 'default',
}) => {
  const isBlue = variant === 'blue'

  return (
    <section className={cn('px-8 py-10 md:px-16 lg:px-30', isBlue ? 'bg-primary' : 'bg-white')}>
      <Container>
        <div className="mb-10 flex flex-col gap-4 text-left">
          <h2 className={cn('text-size-56 font-bold', isBlue ? 'text-white' : 'text-foreground')}>Blog</h2>
        </div>
        <div className={className}>
          <div className="grid gap-12 md:grid-cols-3 md:gap-28">
            {posts.map((post, idx) => (
              <BlogCard
                key={idx}
                title={post.title}
                excerpt={post.excerpt}
                dateLabel={post.dateLabel}
                image={post.image}
                variant={isBlue ? 'inverted' : 'default'}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}

export default BlogCardCollection
