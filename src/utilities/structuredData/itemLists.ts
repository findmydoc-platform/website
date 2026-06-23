import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'

import { buildBreadcrumbListJsonLd } from './breadcrumbs'
import { absoluteUrl, buildNodeId, cleanJsonLdNodes } from './internal'
import type { JsonLdNode } from './types'

type ItemListEntryType = 'Article' | 'MedicalClinic' | 'Thing'

type ItemListEntry = {
  imageUrl?: string | null
  name: string
  type?: ItemListEntryType
  url: string
}

type BuildItemListJsonLdInput = {
  idPath: string
  items: ItemListEntry[]
  name: string
}

export type PostsIndexJsonLdInput = {
  breadcrumbs: BreadcrumbItem[]
  posts: Array<{
    href: string
    image?: {
      src?: string | null
    }
    title: string
  }>
}

export type ListingComparisonJsonLdInput = {
  breadcrumbs: BreadcrumbItem[]
  clinics: Array<{
    actions: {
      details: {
        href: string
      }
    }
    media: {
      src?: string | null
    }
    name: string
  }>
  isCanonicalRoute: boolean
}

const buildItemListJsonLd = ({ idPath, items, name }: BuildItemListJsonLdInput): JsonLdNode | null => {
  const normalizedItems = items
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      url: item.url.trim(),
    }))
    .filter((item) => item.name.length > 0 && item.url.length > 0)

  if (normalizedItems.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@id': buildNodeId(idPath, 'item-list'),
    '@type': 'ItemList',
    itemListElement: normalizedItems.map((item, index) => ({
      '@type': 'ListItem',
      item: {
        '@type': item.type ?? 'Thing',
        image: item.imageUrl ? absoluteUrl(item.imageUrl) : undefined,
        name: item.name,
        url: absoluteUrl(item.url),
      },
      name: item.name,
      position: index + 1,
      url: absoluteUrl(item.url),
    })),
    name,
  }
}

export function buildPostsIndexJsonLd({ breadcrumbs, posts }: PostsIndexJsonLdInput): JsonLdNode[] {
  const path = breadcrumbs.at(-1)?.href ?? '/posts'

  return cleanJsonLdNodes([
    buildBreadcrumbListJsonLd(breadcrumbs),
    buildItemListJsonLd({
      idPath: path,
      items: posts.map((post) => ({
        imageUrl: post.image?.src,
        name: post.title,
        type: 'Article',
        url: post.href,
      })),
      name: 'findmydoc articles',
    }),
  ])
}

export function buildListingComparisonJsonLd({
  breadcrumbs,
  clinics,
  isCanonicalRoute,
}: ListingComparisonJsonLdInput): JsonLdNode[] {
  return cleanJsonLdNodes([
    buildBreadcrumbListJsonLd(breadcrumbs),
    isCanonicalRoute
      ? buildItemListJsonLd({
          idPath: '/listing-comparison',
          items: clinics.map((clinic) => ({
            imageUrl: clinic.media.src,
            name: clinic.name,
            type: 'MedicalClinic',
            url: clinic.actions.details.href,
          })),
          name: 'findmydoc clinic comparison',
        })
      : null,
  ])
}
