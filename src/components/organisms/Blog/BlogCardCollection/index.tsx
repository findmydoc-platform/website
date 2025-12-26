import React from 'react'

import { BlogCard, type BlogCardProps } from '@/components/organisms/Blog/BlogCard'

export type BlogCardCollectionProps = {
  posts: BlogCardProps[]
  className?: string
}

export const BlogCardCollection: React.FC<BlogCardCollectionProps> = ({ posts = [], className }) => {
  return (
    <div className={className}>
      <div className="grid gap-8 md:grid-cols-3">
        {posts.map((post, idx) => (
          <BlogCard key={idx} title={post.title} excerpt={post.excerpt} dateLabel={post.dateLabel} image={post.image} />
        ))}
      </div>
    </div>
  )
}

export default BlogCardCollection
