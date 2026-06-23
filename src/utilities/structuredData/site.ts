import { DEFAULT_SITE_DESCRIPTION, SITE_NAME } from '@/utilities/socialPreview'

import { absoluteUrl, organizationId, websiteId } from './internal'
import type { JsonLdNode } from './types'

export function buildSiteBaseJsonLd(): JsonLdNode[] {
  const homeUrl = absoluteUrl('/')

  return [
    {
      '@context': 'https://schema.org',
      '@id': organizationId(),
      '@type': 'Organization',
      name: SITE_NAME,
      url: homeUrl,
    },
    {
      '@context': 'https://schema.org',
      '@id': websiteId(),
      '@type': 'WebSite',
      description: DEFAULT_SITE_DESCRIPTION,
      name: SITE_NAME,
      publisher: {
        '@id': organizationId(),
      },
      url: homeUrl,
    },
  ]
}
