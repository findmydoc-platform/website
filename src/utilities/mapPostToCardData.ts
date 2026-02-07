import type { Post } from '@/payload-types'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'

/**
 * @deprecated Use normalizePost directly instead
 *
 * Legacy adapter for backwards compatibility.
 * New code should import and use normalizePost from '@/utilities/blog/normalizePost'.
 */
export const mapPostToCardData = (
  post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'>,
): Partial<BlogCardBaseProps> => {
  // For minimal post queries (slug, title, categories, meta only)
  // we don't have full post data, so create a simplified version
  return {
    title: post.title,
    excerpt: post.meta?.description || undefined,
    href: `/posts/${post.slug}`,
    category:
      post.categories && post.categories.length > 0
        ? typeof post.categories[0] === 'object'
          ? post.categories[0].title
          : undefined
        : undefined,
    image:
      post.meta?.image && typeof post.meta.image === 'object'
        ? {
            src: post.meta.image.url || '',
            alt: post.meta.image.alt || '',
          }
        : undefined,
  }
}
