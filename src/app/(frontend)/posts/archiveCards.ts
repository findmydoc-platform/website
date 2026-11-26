import { formatDate } from '@/utilities/blog/formatDate'
import { normalizePost } from '@/utilities/blog/normalizePost'
import type { PostArchiveEntry } from '@/utilities/content/serverData'

export function normalizeArchiveCard({ post, locale, canonicalPath }: PostArchiveEntry) {
  const card = normalizePost(post, { contentLocale: { locale, fallbackLocale: false } })
  const author =
    locale === 'de' && !post.populatedAuthors?.[0]?.name ? { ...card.author, name: 'findmydoc-Redaktion' } : card.author

  return {
    ...card,
    author,
    dateLabel: post.publishedAt ? formatDate(post.publishedAt, locale) : '',
    href: canonicalPath,
    locale,
  }
}
