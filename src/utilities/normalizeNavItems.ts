import { isNotNull, isRecord, resolveHrefFromCMSLink } from '@/blocks/_shared/utils'
import type { UiLinkProps } from '@/components/molecules/Link'

export function normalizeNavItems(
  data: { navItems?: Array<{ link?: unknown }> | null } | null | undefined,
): UiLinkProps[] {
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

/** A single submenu link inside a header nav item. */
export type HeaderSubItem = {
  href: string
  label: string | null
  newTab: boolean
}

/** A top-level header navigation item, optionally containing submenu links. */
export type HeaderNavItem = {
  href: string
  label: string | null
  newTab: boolean
  subItems?: HeaderSubItem[]
}

function normalizeLinkRecord(link: unknown): { href: string; label: string | null; newTab: boolean } | null {
  if (!isRecord(link)) return null

  const href = resolveHrefFromCMSLink({
    type: typeof link.type === 'string' ? (link.type as 'custom' | 'reference') : null,
    url: typeof link.url === 'string' ? link.url : null,
    reference: link.reference,
  })
  if (!href) return null

  return {
    href,
    label: typeof link.label === 'string' ? link.label : null,
    newTab: typeof link.newTab === 'boolean' ? link.newTab : false,
  }
}

/**
 * Normalises header CMS data into a flat-friendly shape that supports optional subItems.
 * Used exclusively by the Header component (the Footer keeps using `normalizeNavItems`).
 */
export function normalizeHeaderNavItems(
  data: { navItems?: Array<{ link?: unknown; subItems?: Array<{ link?: unknown }> | null }> | null } | null | undefined,
): HeaderNavItem[] {
  return (data?.navItems ?? [])
    .map((item) => {
      const resolved = normalizeLinkRecord(item?.link)
      if (!resolved) return null

      const subItems = (item.subItems ?? []).map((sub) => normalizeLinkRecord(sub?.link)).filter(isNotNull)

      return {
        ...resolved,
        ...(subItems.length > 0 ? { subItems } : {}),
      } satisfies HeaderNavItem
    })
    .filter(isNotNull)
}
