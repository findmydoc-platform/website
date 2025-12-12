import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

import type { Footer as FooterType } from '@/payload-types'
import type { Header } from '@/payload-types'

import { FooterContent } from './FooterContent'
import type { UiLinkProps } from '@/components/molecules/Link'
import { isNotNull, isRecord, resolveHrefFromCMSLink } from '@/blocks/_shared/utils'

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
