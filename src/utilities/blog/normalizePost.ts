import type { Post } from '@/payload-types'
import { formatDate } from './formatDate'
import { calculateReadTime } from './calculateReadTime'
import { resolveMediaImage } from '@/utilities/media/resolveMediaImage'

export type BlogCardImageProps = {
  src: string
  alt: string
  width?: number
  height?: number
}

export type BlogCardAuthorProps = {
  name: string
  avatar?: string
  role?: string
}

export type BlogCardBaseProps = {
  title: string
  excerpt?: string
  href: string
  dateLabel?: string
  readTime?: string
  category?: string
  image?: BlogCardImageProps
  author?: BlogCardAuthorProps
  className?: string
}

/**
 * Normalize a Payload Post to presentational BlogCard props
 * Handles complex Payload types (relationships, uploads) and converts to simple props
 *
 * Works with both full Post objects and partial selections from queries
 */
export function normalizePost(post: Partial<Post> & Pick<Post, 'title' | 'slug'>): BlogCardBaseProps {
  // Normalize hero image
  const heroImage = typeof post.heroImage === 'object' && post.heroImage !== null ? post.heroImage : null
  const imageProps: BlogCardImageProps | undefined = resolveMediaImage(heroImage, post.title)

  // Normalize author (use first populated author from populatedAuthors)
  let authorProps: BlogCardAuthorProps | undefined

  if (post.populatedAuthors && post.populatedAuthors.length > 0) {
    const firstAuthor = post.populatedAuthors[0]
    if (firstAuthor && typeof firstAuthor === 'object') {
      authorProps = {
        name: firstAuthor.name || 'Unknown',
        avatar: firstAuthor.avatar || undefined,
        role: undefined,
      }
    }
  }

  // Normalize category (use first category only)
  let categoryName: string | undefined
  if (post.categories && Array.isArray(post.categories) && post.categories.length > 0) {
    const firstCategory = post.categories[0]
    if (typeof firstCategory === 'object' && firstCategory !== null && 'title' in firstCategory) {
      categoryName = firstCategory.title as string
    }
  }

  // Format date
  const dateLabel = post.publishedAt ? formatDate(post.publishedAt) : ''

  // Calculate read time
  const readTime = calculateReadTime(post.content)

  return {
    title: post.title,
    excerpt: post.excerpt || undefined,
    href: `/posts/${post.slug}`,
    dateLabel,
    readTime,
    category: categoryName,
    image: imageProps,
    author: authorProps,
  }
}
