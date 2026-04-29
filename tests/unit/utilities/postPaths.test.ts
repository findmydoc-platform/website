import { describe, expect, it } from 'vitest'

import { buildPostPath, buildPostsIndexPath, buildPostsPagePath } from '@/utilities/content/postPaths'

const germanContentLocale = {
  locale: 'de' as const,
  fallbackLocale: 'en' as const,
}

describe('post path builders', () => {
  it('keeps default paths canonical without locale query params', () => {
    expect(buildPostsIndexPath()).toBe('/posts')
    expect(buildPostPath('hello-world')).toBe('/posts/hello-world')
    expect(buildPostsPagePath(2)).toBe('/posts/page/2')
  })

  it('appends the non-default content locale to all post paths', () => {
    expect(buildPostsIndexPath(germanContentLocale)).toBe('/posts?locale=de')
    expect(buildPostPath('hello-world', germanContentLocale)).toBe('/posts/hello-world?locale=de')
    expect(buildPostsPagePath(2, germanContentLocale)).toBe('/posts/page/2?locale=de')
  })

  it('maps page one back to the localized posts index path', () => {
    expect(buildPostsPagePath(1, germanContentLocale)).toBe('/posts?locale=de')
  })
})
