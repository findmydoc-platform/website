import { describe, expect, it } from 'vitest'

import { appendContentLocaleToHref, resolveHrefFromCMSLink, resolveHrefFromReference } from '@/blocks/_shared/utils'

const germanContentLocale = {
  locale: 'de' as const,
  fallbackLocale: 'en' as const,
}

describe('shared CMS link utilities', () => {
  it('links an English Page reference to its public English route', () => {
    expect(resolveHrefFromReference({ relationTo: 'pages', value: { slug: 'our-team' } }, { locale: 'en' })).toBe(
      '/en/our-team',
    )
  })

  it('does not link a historical German Page whose slug belongs to the English namespace', () => {
    expect(
      resolveHrefFromReference({ relationTo: 'pages', value: { slug: 'en/old-page' } }, { locale: 'de' }),
    ).toBeUndefined()
  })

  it('localizes internal reference links for pages and posts', () => {
    expect(
      resolveHrefFromReference(
        {
          relationTo: 'pages',
          value: { slug: 'privacy-policy' },
        },
        germanContentLocale,
      ),
    ).toBe('/privacy-policy')

    expect(
      resolveHrefFromReference(
        {
          relationTo: 'posts',
          value: { slug: 'hello-world' },
        },
        germanContentLocale,
      ),
    ).toBe('/posts/hello-world')
  })

  it('localizes internal CMS links while leaving external targets untouched', () => {
    expect(
      resolveHrefFromCMSLink(
        {
          type: 'reference',
          reference: {
            relationTo: 'pages',
            value: { slug: 'contact' },
          },
        },
        germanContentLocale,
      ),
    ).toBe('/contact')

    expect(
      resolveHrefFromCMSLink(
        {
          type: 'custom',
          url: '/privacy-policy?foo=bar#details',
        },
        germanContentLocale,
      ),
    ).toBe('/privacy-policy?foo=bar&locale=de#details')

    expect(
      resolveHrefFromCMSLink(
        {
          type: 'custom',
          url: 'https://example.com/privacy-policy',
        },
        germanContentLocale,
      ),
    ).toBe('https://example.com/privacy-policy')
  })

  it('only appends locale params to root-relative internal hrefs', () => {
    expect(appendContentLocaleToHref('/posts/hello-world', germanContentLocale)).toBe('/posts/hello-world?locale=de')
    expect(appendContentLocaleToHref('mailto:test@example.com', germanContentLocale)).toBe('mailto:test@example.com')
    expect(appendContentLocaleToHref('https://example.com/posts/hello-world', germanContentLocale)).toBe(
      'https://example.com/posts/hello-world',
    )
  })
})
