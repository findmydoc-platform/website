import type { Post } from '@/payload-types'
import type { BlogCardProps } from '@/components/organisms/Blog/BlogCard'

export const mapPostToCardData = (post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'>): BlogCardProps => {
  return {
    title: post.title,
    excerpt: post.meta?.description || undefined,
    dateLabel: undefined,
    image:
      post.meta?.image && typeof post.meta.image === 'object'
        ? {
            src: post.meta.image.url || '',
            alt: post.meta.image.alt || '',
          }
        : undefined,
  }
}
