import { describe, expect, it } from 'vitest'

import { buildPostPath, buildPostsIndexPath, buildPostsPagePath } from '@/utilities/content/postPaths'

const germanContentLocale = {
  locale: 'de' as const,
  fallbackLocale: 'en' as const,
}

describe('post path builders', () => {
  it('keeps default paths canonical without locale query params', () => {
    expect(buildPostsIndexPath()).toBe('/posts')
    expect(buildPostPath('hello-world')).toBe('/en/posts/hello-world')
    expect(buildPostsPagePath(2)).toBe('/posts/page/2')
  })

  it('keeps the German post canonical unprefixed and keeps German pagination in the unprefixed archive', () => {
    expect(buildPostsIndexPath(germanContentLocale)).toBe('/posts')
    expect(buildPostPath('hello-world', germanContentLocale)).toBe('/posts/hello-world')
    expect(buildPostsPagePath(2, germanContentLocale)).toBe('/posts/page/2')
  })

  it('links to the English archive and its pagination without a locale query', () => {
    const english = { locale: 'en' } as const
    expect(buildPostsIndexPath(english)).toBe('/en/posts')
    expect(buildPostsPagePath(1, english)).toBe('/en/posts')
    expect(buildPostsPagePath(2, english)).toBe('/en/posts/page/2')
  })

  it('maps page one back to the localized posts index path', () => {
    expect(buildPostsPagePath(1, germanContentLocale)).toBe('/posts')
  })
})
