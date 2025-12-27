import React from 'react'

import { BlogCard, type BlogCardProps } from '@/components/organisms/Blog/BlogCard'
import { Container } from '@/components/molecules/Container'

export type BlogCardCollectionProps = {
  posts: BlogCardProps[]
  className?: string
}

export const BlogCardCollection: React.FC<BlogCardCollectionProps> = ({ posts = [], className }) => {
  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-12 text-center">
          <h2 className="mb-6 text-5xl font-bold text-foreground">Blog</h2>
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
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}

export default BlogCardCollection
