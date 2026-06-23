import { describe, expect, it, vi } from 'vitest'

import {
  buildArticlePageJsonLd,
  buildClinicDetailPageJsonLd,
  buildListingComparisonJsonLd,
  buildPostsIndexJsonLd,
  buildSiteBaseJsonLd,
} from '@/utilities/structuredData'

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: vi.fn(() => 'https://findmydoc.eu'),
}))

describe('structured data builders', () => {
  it('builds stable site base Organization and WebSite nodes', () => {
    expect(buildSiteBaseJsonLd()).toEqual([
      expect.objectContaining({
        '@id': 'https://findmydoc.eu/#organization',
        '@type': 'Organization',
        name: 'findmydoc',
        url: 'https://findmydoc.eu/',
      }),
      expect.objectContaining({
        '@id': 'https://findmydoc.eu/#website',
        '@type': 'WebSite',
        publisher: {
          '@id': 'https://findmydoc.eu/#organization',
        },
      }),
    ])
  })

  it('builds Article and BreadcrumbList data from visible post fields', () => {
    const result = buildArticlePageJsonLd({
      authorName: 'Ada Lovelace',
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: 'Blog', href: '/posts' },
        { label: 'Article', href: '/posts/article' },
      ],
      description: 'Public article summary.',
      imageUrl: '/media/article.webp',
      path: '/posts/article',
      publishedAt: '2026-01-01T00:00:00.000Z',
      title: 'Public Article',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    expect(result).toEqual([
      expect.objectContaining({ '@type': 'BreadcrumbList' }),
      expect.objectContaining({
        '@id': 'https://findmydoc.eu/posts/article#article',
        '@type': 'Article',
        author: {
          '@type': 'Person',
          name: 'Ada Lovelace',
        },
        dateModified: '2026-01-02T00:00:00.000Z',
        datePublished: '2026-01-01T00:00:00.000Z',
        headline: 'Public Article',
        image: ['https://findmydoc.eu/media/article.webp'],
        url: 'https://findmydoc.eu/posts/article',
      }),
    ])
  })

  it('builds ItemList data from visible post cards', () => {
    const result = buildPostsIndexJsonLd({
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: 'Blog', href: '/posts' },
      ],
      posts: [
        {
          href: '/posts/article',
          title: 'Public Article',
        },
      ],
    })

    expect(result).toEqual([
      expect.objectContaining({ '@type': 'BreadcrumbList' }),
      expect.objectContaining({
        '@id': 'https://findmydoc.eu/posts#item-list',
        '@type': 'ItemList',
        itemListElement: [
          expect.objectContaining({
            item: expect.objectContaining({
              '@type': 'Article',
              name: 'Public Article',
              url: 'https://findmydoc.eu/posts/article',
            }),
            position: 1,
          }),
        ],
      }),
    ])
  })

  it('omits listing discovery ItemList data for query variants', () => {
    const breadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Clinics', href: '/listing-comparison' },
    ]
    const clinics = [
      {
        actions: { details: { href: '/clinics/berlin-health', label: 'View profile' } },
        id: '42',
        location: 'Berlin',
        media: { src: '/clinic.webp', alt: 'Berlin Health' },
        name: 'Berlin Health',
        rating: { value: 0, count: 0 },
        tags: [],
        verification: { variant: 'gold' },
      },
    ]

    expect(buildListingComparisonJsonLd({ breadcrumbs, clinics, isCanonicalRoute: false })).toEqual([
      expect.objectContaining({ '@type': 'BreadcrumbList' }),
    ])
    expect(buildListingComparisonJsonLd({ breadcrumbs, clinics, isCanonicalRoute: true })).toEqual([
      expect.objectContaining({ '@type': 'BreadcrumbList' }),
      expect.objectContaining({ '@type': 'ItemList' }),
    ])
  })

  it('builds conservative MedicalClinic data without ratings or trust claims', () => {
    const clinicDetailData = {
      beforeAfterEntries: [],
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: 'Clinics', href: '/listing-comparison' },
        { label: 'Berlin Health', href: '/clinics/berlin-health' },
      ],
      clinicId: 42,
      clinicName: 'Berlin Health',
      clinicSlug: 'berlin-health',
      contactHref: '/contact?clinic=berlin-health',
      description: 'Public clinic description.',
      doctors: [
        {
          id: '1',
          image: { src: '/doctor.webp', alt: 'Doctor' },
          name: 'Dr Ada',
          specialty: 'Dentistry',
          contactHref: '#',
        },
      ],
      freshness: { sourceCollections: ['clinics'] },
      heroImage: { src: '/clinic.webp', alt: 'Berlin Health' },
      location: { fullAddress: 'Example Street 1, Berlin' },
      reviews: { items: [], totalCount: 25 },
      treatments: [{ id: 'dental-implant', name: 'Dental implant', priceFromUsd: 1000 }],
      trust: {
        accreditations: ['Visible badge'],
        languages: ['English'],
        ratingValue: 4.8,
        reviewCount: 25,
        verification: 'gold',
      },
    }

    const result = buildClinicDetailPageJsonLd(clinicDetailData)

    const clinicNode = result.find((node) => node['@type'] === 'MedicalClinic')
    expect(clinicNode).toMatchObject({
      '@id': 'https://findmydoc.eu/clinics/berlin-health#clinic',
      '@type': 'MedicalClinic',
      availableService: [{ '@type': 'MedicalProcedure', name: 'Dental implant' }],
      employee: [{ '@type': 'Physician', medicalSpecialty: 'Dentistry', name: 'Dr Ada' }],
      name: 'Berlin Health',
      url: 'https://findmydoc.eu/clinics/berlin-health',
    })
    expect(clinicNode).not.toHaveProperty('aggregateRating')
    expect(clinicNode).not.toHaveProperty('reviewCount')
    expect(clinicNode).not.toHaveProperty('accreditation')
    expect(clinicNode).not.toHaveProperty('verification')
  })
})
