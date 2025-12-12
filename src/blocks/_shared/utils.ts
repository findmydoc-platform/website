/**
 * Shared utility functions for resolving CMS links and types.
 * These utilities help normalize Payload-shaped links into presentational props.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export type CMSLinkShape = {
  type?: 'custom' | 'reference' | null
  url?: string | null
  reference?: unknown
}

/**
 * Resolves a CMS link shape into a plain href string.
 * Handles both reference links (with relationTo/value/slug) and custom URL links.
 */
export function resolveHrefFromCMSLink(link: CMSLinkShape): string | undefined {
  if (link.type === 'reference' && isRecord(link.reference)) {
    const relationTo = link.reference['relationTo']
    const value = link.reference['value']

    if (typeof relationTo === 'string' && isRecord(value)) {
      const slug = value['slug']
      if (typeof slug === 'string' && slug.length > 0) {
        return `${relationTo !== 'pages' ? `/${relationTo}` : ''}/${slug}`
      }
    }
  }

  if (typeof link.url === 'string' && link.url.length > 0) {
    return link.url
  }

  return undefined
}
