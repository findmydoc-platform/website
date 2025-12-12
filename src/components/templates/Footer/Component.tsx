import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

import type { Footer as FooterType } from '@/payload-types'
import type { Header } from '@/payload-types'

import { FooterContent } from './FooterContent'
import type { UiLinkProps } from '@/components/molecules/Link'

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function resolveHrefFromCMSLink(link: {
  type?: 'custom' | 'reference' | null
  url?: string | null
  reference?: unknown
}): string | undefined {
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

  if (typeof link.url === 'string' && link.url.length > 0) return link.url

  return undefined
}

function normalizeNavItems(data: { navItems?: Array<{ link?: unknown }> | null } | null | undefined): UiLinkProps[] {
  return (data?.navItems ?? [])
    .map((item) => {
      const link = item?.link

      const href = isRecord(link)
        ? resolveHrefFromCMSLink({
            type: typeof link.type === 'string' ? (link.type as 'custom' | 'reference') : null,
            url: typeof link.url === 'string' ? link.url : null,
            reference: link.reference,
          })
        : undefined
      if (!href) return null

      return {
        href,
        label: isRecord(link) && typeof link.label === 'string' ? link.label : null,
        newTab: isRecord(link) && typeof link.newTab === 'boolean' ? link.newTab : false,
        appearance: 'inline',
      } satisfies UiLinkProps
    })
    .filter(isNotNull)
}

export async function Footer() {
  const footerData: FooterType = await getCachedGlobal('footer', 1)()
  const headerData: Header = await getCachedGlobal('header', 1)()

  const footerNavItems = normalizeNavItems(footerData)
  const headerNavItems = normalizeNavItems(headerData)

  return <FooterContent footerNavItems={footerNavItems} headerNavItems={headerNavItems} />
}
