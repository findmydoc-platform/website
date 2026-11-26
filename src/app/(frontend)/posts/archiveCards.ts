import { normalizePost } from '@/utilities/blog/normalizePost'
import type { PostArchiveEntry } from '@/utilities/content/serverData'

export function normalizeArchiveCard({ post, locale, canonicalPath }: PostArchiveEntry) {
  return {
    ...normalizePost(post, { contentLocale: { locale, fallbackLocale: false } }),
    href: canonicalPath,
    locale,
  }
}
