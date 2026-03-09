import { isNotNull, isRecord, resolveHrefFromCMSLink } from '@/blocks/_shared/utils'
import type { UiLinkProps } from '@/components/molecules/Link'
import { REQUIRED_LEGAL_FOOTER_LINKS } from '@/utilities/legalPages'

type SupportedLinkType = 'custom' | 'reference' | 'group'

function resolveLinkType(value: unknown): SupportedLinkType | null {
  if (value === 'custom' || value === 'reference' || value === 'group') {
    return value
  }
  return null
}

export function normalizeNavItems(
  data: { navItems?: Array<{ link?: unknown }> | null } | null | undefined,
): UiLinkProps[] {
  return (data?.navItems ?? [])
    .map((item) => {
      const link = item?.link

      const href = isRecord(link)
        ? resolveHrefFromCMSLink({
            type: resolveLinkType(link.type),
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
  href?: string
  label: string | null
  newTab: boolean
  subItems?: HeaderSubItem[]
}

export type FooterNavGroupTitle = 'About' | 'Service' | 'Information'

export type FooterNavGroup = {
  title: FooterNavGroupTitle
  items: UiLinkProps[]
}

function normalizeLinkRecord(
  link: unknown,
  options: { allowGroupWithoutHref?: boolean } = {},
): { href?: string; label: string | null; newTab: boolean } | null {
  if (!isRecord(link)) return null

  const linkType = resolveLinkType(link.type)
  const href = resolveHrefFromCMSLink({
    type: linkType,
    url: typeof link.url === 'string' ? link.url : null,
    reference: link.reference,
  })
  if (!href && !(options.allowGroupWithoutHref && linkType === 'group')) return null

  return {
    ...(href ? { href } : {}),
    label: typeof link.label === 'string' ? link.label : null,
    newTab: linkType === 'group' ? false : typeof link.newTab === 'boolean' ? link.newTab : false,
  }
}

function normalizeFooterGroupItems(links: Array<{ link?: unknown }> | null | undefined): UiLinkProps[] {
  return (links ?? [])
    .map((item) => normalizeLinkRecord(item?.link))
    .filter((item): item is { href: string; label: string | null; newTab: boolean } => Boolean(item?.href))
    .map((item) => ({
      href: item.href,
      label: item.label,
      newTab: item.newTab,
      appearance: 'inline',
    }))
}

function appendRequiredLegalFooterLinks(items: UiLinkProps[]): UiLinkProps[] {
  const existingHrefs = new Set(items.map((item) => item.href))
  const missingRequired = REQUIRED_LEGAL_FOOTER_LINKS.filter((item) => !existingHrefs.has(item.href))

  return [...items, ...missingRequired]
}

export function normalizeFooterNavGroups(
  data:
    | {
        aboutLinks?: Array<{ link?: unknown }> | null
        serviceLinks?: Array<{ link?: unknown }> | null
        informationLinks?: Array<{ link?: unknown }> | null
      }
    | null
    | undefined,
): FooterNavGroup[] {
  const informationItems = appendRequiredLegalFooterLinks(normalizeFooterGroupItems(data?.informationLinks))

  return [
    { title: 'About', items: normalizeFooterGroupItems(data?.aboutLinks) },
    { title: 'Service', items: normalizeFooterGroupItems(data?.serviceLinks) },
    { title: 'Information', items: informationItems },
  ]
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
      const resolved = normalizeLinkRecord(item?.link, { allowGroupWithoutHref: true })
      if (!resolved) return null

      const subItems = (item.subItems ?? [])
        .map((sub) => normalizeLinkRecord(sub?.link))
        .filter((sub): sub is HeaderSubItem => Boolean(sub?.href))
        .map((sub) => ({
          href: sub.href,
          label: sub.label,
          newTab: sub.newTab,
        }))

      if (!resolved.href && subItems.length === 0) return null

      return {
        ...resolved,
        ...(subItems.length > 0 ? { subItems } : {}),
      } satisfies HeaderNavItem
    })
    .filter(isNotNull)
}
