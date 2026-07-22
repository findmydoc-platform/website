import demoPosts from '@/endpoints/seed/data/demo/posts.json'
import { describe, expect, it } from 'vitest'

describe('demo posts localization seed', () => {
  it.each(demoPosts.map((post) => [post.slug, post] as const))(
    'stores bilingual localized fields for %s',
    (_slug, post) => {
      const localizedStrings = [post.title, post.excerpt, post.meta.title, post.meta.description]

      for (const value of localizedStrings) {
        expect(value.en.trim().length).toBeGreaterThan(0)
        expect(value.de.trim().length).toBeGreaterThan(0)
        expect(value.de).not.toBe(value.en)
      }

      expect(post.content.en.root.type).toBe('root')
      expect(post.content.en.root.children.length).toBeGreaterThan(0)
      expect(post.content.de.root.type).toBe('root')
      expect(post.content.de.root.children.length).toBeGreaterThan(0)
      expect(JSON.stringify(post.content.de)).not.toBe(JSON.stringify(post.content.en))
    },
  )
})
