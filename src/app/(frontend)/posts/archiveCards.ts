import { formatDate } from '@/utilities/blog/formatDate'
import { normalizePost } from '@/utilities/blog/normalizePost'
import type { PostArchiveEntry } from '@/utilities/content/serverData'

export function normalizeArchiveCard({ post, locale, canonicalPath }: PostArchiveEntry, editorialAuthor: string) {
  const card = normalizePost(post, { contentLocale: { locale, fallbackLocale: false } })

  return {
    ...card,
    author: post.populatedAuthors?.[0]?.name ? card.author : { ...card.author, name: editorialAuthor },
    dateLabel: post.publishedAt ? formatDate(post.publishedAt, locale) : '',
    dateLang: locale,
    href: canonicalPath,
    locale,
  }
}
