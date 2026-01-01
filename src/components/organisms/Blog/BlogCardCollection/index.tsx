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
    <section className={cn('py-20', isBlue ? 'bg-primary' : 'bg-white')}>
      <Container>
        <div className="mb-12 text-center">
          <h2 className={cn('mb-6 text-5xl font-bold', isBlue ? 'text-white' : 'text-foreground')}>Blog</h2>
        </div>
        <div className={className}>
          <div className="grid gap-8 md:grid-cols-3">
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
