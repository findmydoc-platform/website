/**
 * Shared utility functions for resolving CMS links and types.
 * These utilities help normalize Payload-shaped links into presentational props.
 */

import { appendContentLocaleToPath, type ContentLocaleContext } from '@/utilities/contentLocalization'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export type CMSLinkShape = {
  type?: 'custom' | 'reference' | 'group' | null
  url?: string | null
  reference?: unknown
}

type CMSReferenceShape = {
  relationTo?: unknown
  value?: unknown
}

function buildReferencePath(relationTo: string, slug: string): string {
  return `${relationTo !== 'pages' ? `/${relationTo}` : ''}/${slug}`
}

export function appendContentLocaleToHref(href: string, contentLocale?: ContentLocaleContext): string {
  if (!contentLocale?.locale || !href.startsWith('/') || href.startsWith('//')) {
    return href
  }

  return appendContentLocaleToPath(href, contentLocale.locale)
}

export function resolveHrefFromReference(
  reference: CMSReferenceShape,
  contentLocale?: ContentLocaleContext,
): string | undefined {
  const { relationTo, value } = reference

  if (typeof relationTo !== 'string' || !isRecord(value)) {
    return undefined
  }

  const slug = value['slug']

  if (typeof slug !== 'string' || slug.length === 0) {
    return undefined
  }

  return appendContentLocaleToHref(buildReferencePath(relationTo, slug), contentLocale)
}

/**
 * Resolves a CMS link shape into a plain href string.
 * Handles both reference links (with relationTo/value/slug) and custom URL links.
 */
export function resolveHrefFromCMSLink(link: CMSLinkShape, contentLocale?: ContentLocaleContext): string | undefined {
  if (link.type === 'group') {
    return undefined
  }

  if (link.type === 'reference' && isRecord(link.reference)) {
    const href = resolveHrefFromReference(
      {
        relationTo: link.reference['relationTo'],
        value: link.reference['value'],
      },
      contentLocale,
    )

    if (href) {
      return href
    }
  }

  if (typeof link.url === 'string' && link.url.length > 0) {
    return appendContentLocaleToHref(link.url, contentLocale)
  }

  return undefined
}
