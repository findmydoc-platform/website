import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'

import { buildBreadcrumbListJsonLd } from './breadcrumbs'
import { absoluteUrl, buildNodeId, cleanJsonLdNodes } from './internal'
import type { JsonLdNode } from './types'

type ItemListEntryType = 'Article' | 'MedicalClinic' | 'Thing'

type ItemListEntry = {
  imageUrl?: string | null
  inLanguage?: string
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
  listName?: string
  posts: Array<{
    href: string
    locale?: string
    image?: {
      src?: string | null
    }
    title: string
  }>
}

export type ListingComparisonJsonLdInput = {
  breadcrumbs: BreadcrumbItem[]
  canonicalPath?: string
  listName?: string
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
        inLanguage: item.inLanguage,
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

export function buildPostsIndexJsonLd({
  breadcrumbs,
  posts,
  listName = 'findmydoc articles',
}: PostsIndexJsonLdInput): JsonLdNode[] {
  const path = breadcrumbs.at(-1)?.href ?? '/posts'

  return cleanJsonLdNodes([
    buildBreadcrumbListJsonLd(breadcrumbs),
    buildItemListJsonLd({
      idPath: path,
      items: posts.map((post) => ({
        imageUrl: post.image?.src,
        inLanguage: post.locale,
        name: post.title,
        type: 'Article',
        url: post.href,
      })),
      name: listName,
    }),
  ])
}

export function buildListingComparisonJsonLd({
  breadcrumbs,
  canonicalPath = '/listing-comparison',
  listName = 'findmydoc clinic comparison',
  clinics,
  isCanonicalRoute,
}: ListingComparisonJsonLdInput): JsonLdNode[] {
  return cleanJsonLdNodes([
    buildBreadcrumbListJsonLd(breadcrumbs),
    isCanonicalRoute
      ? buildItemListJsonLd({
          idPath: canonicalPath,
          items: clinics.map((clinic) => ({
            imageUrl: clinic.media.src,
            name: clinic.name,
            type: 'MedicalClinic',
            url: clinic.actions.details.href,
          })),
          name: listName,
        })
      : null,
  ])
}
