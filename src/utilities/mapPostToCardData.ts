import type { Post } from '@/payload-types'
import type { PostCardData } from '@/components/organisms/PostCard'

export const mapPostToCardData = (post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'>): PostCardData => {
  return {
    title: post.title,
    href: `/posts/${post.slug}`,
    description: post.meta?.description || undefined,
    image:
      post.meta?.image && typeof post.meta.image === 'object'
        ? {
            src: post.meta.image.url || '',
            alt: post.meta.image.alt || '',
            width: post.meta.image.width || undefined,
            height: post.meta.image.height || undefined,
          }
        : undefined,
    categories: post.categories
      ?.map((cat) => (typeof cat === 'object' ? cat.title : null))
      .filter((title): title is string => typeof title === 'string'),
  }
}
