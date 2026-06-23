import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'

import { buildBreadcrumbListJsonLd } from './breadcrumbs'
import { absoluteUrl, buildNodeId, cleanJsonLdNodes, organizationId } from './internal'
import type { JsonLdNode } from './types'

export type ArticlePageJsonLdInput = {
  authorName?: string | null
  breadcrumbs: BreadcrumbItem[]
  description?: string | null
  imageUrl?: string | null
  path: string
  publishedAt?: string | null
  title: string
  updatedAt?: string | null
}

export function buildArticlePageJsonLd({
  authorName,
  breadcrumbs,
  description,
  imageUrl,
  path,
  publishedAt,
  title,
  updatedAt,
}: ArticlePageJsonLdInput): JsonLdNode[] {
  const pageUrl = absoluteUrl(path)

  return cleanJsonLdNodes([
    buildBreadcrumbListJsonLd(breadcrumbs),
    {
      '@context': 'https://schema.org',
      '@id': buildNodeId(path, 'article'),
      '@type': 'Article',
      author: authorName
        ? {
            '@type': 'Person',
            name: authorName,
          }
        : undefined,
      dateModified: updatedAt ?? publishedAt,
      datePublished: publishedAt,
      description,
      headline: title,
      image: imageUrl ? [absoluteUrl(imageUrl)] : undefined,
      mainEntityOfPage: {
        '@id': pageUrl,
        '@type': 'WebPage',
      },
      publisher: {
        '@id': organizationId(),
      },
      url: pageUrl,
    },
  ])
}
