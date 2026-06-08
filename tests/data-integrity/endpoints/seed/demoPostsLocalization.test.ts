import demoPosts from '@/endpoints/seed/data/demo/posts.json'
import { describe, expect, it } from 'vitest'

type LocalizedString = {
  en: string
  de: string
}

type LocalizedRichText = {
  en: unknown
  de: unknown
}

function isLocalizedString(value: unknown): value is LocalizedString {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { en?: unknown }).en === 'string' &&
    typeof (value as { de?: unknown }).de === 'string'
  )
}

function isLocalizedRichText(value: unknown): value is LocalizedRichText {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { en?: unknown }).en === 'object' &&
    (value as { en?: unknown }).en !== null &&
    typeof (value as { de?: unknown }).de === 'object' &&
    (value as { de?: unknown }).de !== null
  )
}

describe('demo posts localization seed', () => {
  it.each(demoPosts.map((post) => [post.slug, post] as const))(
    'stores bilingual localized fields for %s',
    (_slug, post) => {
      expect(isLocalizedString(post.title)).toBe(true)
      expect(isLocalizedString(post.excerpt)).toBe(true)
      expect(isLocalizedString(post.meta?.title)).toBe(true)
      expect(isLocalizedString(post.meta?.description)).toBe(true)
      expect(isLocalizedRichText(post.content)).toBe(true)

      if (!isLocalizedString(post.title) || !isLocalizedString(post.excerpt)) {
        throw new Error(`Expected localized title and excerpt for ${post.slug}`)
      }

      if (!isLocalizedString(post.meta?.title) || !isLocalizedString(post.meta?.description)) {
        throw new Error(`Expected localized SEO fields for ${post.slug}`)
      }

      if (!isLocalizedRichText(post.content)) {
        throw new Error(`Expected localized rich text content for ${post.slug}`)
      }

      expect(post.title.de).not.toBe(post.title.en)
      expect(post.excerpt.de).not.toBe(post.excerpt.en)
      expect(post.meta.title.de).not.toBe(post.meta.title.en)
      expect(post.meta.description.de).not.toBe(post.meta.description.en)
      expect(JSON.stringify(post.content.de)).not.toBe(JSON.stringify(post.content.en))
    },
  )
})
