import { describe, expect, it } from 'vitest'

import {
  classifyHoldingPublicDestination,
  projectHoldingFooterLinks,
  projectHoldingFooterGroups,
  projectHoldingHeaderNavItems,
} from '@/features/temporaryLandingMode/navigation'

const origin = 'https://findmydoc.eu'

describe('Holding public navigation policy', () => {
  it.each([
    ['/', 'holding-home'],
    ['https://findmydoc.eu/posts/?page=2#latest', 'blog-index'],
    ['/posts/page/1/', 'blog-pagination'],
    ['/posts/a-published-post?ref=nav', 'blog-article'],
    ['/contact#form', 'contact'],
    ['/privacy-policy/', 'privacy'],
    ['/imprint?from=footer', 'imprint'],
  ] as const)('classifies permitted destination %s', (href, expected) => {
    expect(classifyHoldingPublicDestination(href, origin)).toBe(expected)
  })

  it.each([
    ['/privacy', null],
    ['/posts/page/0', null],
    ['/posts/page/01', null],
    ['/posts/page/2/extra', null],
    ['/posts-extra', null],
    ['/posts/a/b', null],
    ['/posts/a%2Fb', null],
    ['/posts/%ZZ', null],
    ['/contact-us', null],
    ['https://other.example/posts', null],
    ['https://findmydoc.eu.evil.example/posts', null],
    ['https://findmydoc.eu/clinics', null],
    ['mailto:hello@findmydoc.eu', null],
  ] as const)('rejects unapproved destination %s', (href, expected) => {
    expect(classifyHoldingPublicDestination(href, origin)).toBe(expected)
  })

  it('keeps only permitted header destinations and retains groups with permitted children', () => {
    const projected = projectHoldingHeaderNavItems(
      [
        { href: '/clinics', label: 'Unavailable', newTab: false },
        {
          href: '/services',
          label: 'Guides',
          newTab: false,
          subItems: [
            { href: '/posts/first', label: 'First guide', newTab: false },
            { href: 'https://social.example', label: 'Social', newTab: true },
          ],
        },
        {
          label: 'Resources',
          newTab: false,
          subItems: [{ href: '/posts', label: 'Blog', newTab: false }],
        },
        {
          label: 'Empty group',
          newTab: false,
          subItems: [{ href: '/clinics', label: 'Clinics', newTab: false }],
        },
      ],
      origin,
    )

    expect(projected).toEqual([
      {
        label: 'Guides',
        newTab: false,
        subItems: [{ href: '/posts/first', label: 'First guide', newTab: false }],
      },
      {
        label: 'Resources',
        newTab: false,
        subItems: [{ href: '/posts', label: 'Blog', newTab: false }],
      },
    ])
  })

  it('filters footer groups without changing permitted labels or order', () => {
    const projected = projectHoldingFooterGroups(
      [
        {
          title: 'About',
          items: [
            { href: '/clinics', label: 'Clinics', newTab: false, appearance: 'inline' },
            { href: '/contact', label: 'Contact', newTab: false, appearance: 'inline' },
          ],
        },
        {
          title: 'Services',
          items: [{ href: 'https://social.example', label: 'Social', newTab: true, appearance: 'inline' }],
        },
        {
          title: 'Information',
          items: [{ href: '/imprint', label: 'Legal', newTab: false, appearance: 'inline' }],
        },
      ],
      origin,
    )

    expect(projected).toEqual([
      {
        title: 'About',
        items: [{ href: '/contact', label: 'Contact', newTab: false, appearance: 'inline' }],
      },
      {
        title: 'Information',
        items: [{ href: '/imprint', label: 'Legal', newTab: false, appearance: 'inline' }],
      },
    ])
  })

  it('applies the same destination policy to the Holding page footer', () => {
    expect(
      projectHoldingFooterLinks(
        [
          { href: '/privacy-policy', label: 'Privacy', appearance: 'inline' },
          { href: '/imprint', label: 'Imprint', appearance: 'inline' },
          { href: 'https://social.example', label: 'Social', appearance: 'inline' },
        ],
        origin,
      ),
    ).toEqual([
      { href: '/privacy-policy', label: 'Privacy', appearance: 'inline' },
      { href: '/imprint', label: 'Imprint', appearance: 'inline' },
    ])
  })
})
