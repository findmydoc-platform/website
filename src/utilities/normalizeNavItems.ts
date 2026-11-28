import { isNotNull, isRecord, resolveHrefFromCMSLink } from '@/blocks/_shared/utils'
import type { ContentLocale } from '@/utilities/contentLocalization'
import type { UiLinkProps } from '@/components/molecules/Link'
import { getManagedLegalPageSlugFromPath, isManagedLegalPageSlug, LEGACY_LEGAL_REDIRECTS, REQUIRED_LEGAL_FOOTER_LINKS } from '@/utilities/legalPages'

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
  hrefLang?: string
  lang?: string
  newTab: boolean
}

/** A top-level header navigation item, optionally containing submenu links. */
export type HeaderNavItem = {
  href?: string
  label: string | null
  hrefLang?: string
  lang?: string
  newTab: boolean
  subItems?: HeaderSubItem[]
}

export type FooterNavGroupTitle = 'About' | 'Services' | 'Information'

export type FooterNavGroup = {
  title: string
  items: UiLinkProps[]
}

function normalizeLinkRecord(
  link: unknown,
  options: { allowGroupWithoutHref?: boolean; locale?: ContentLocale } = {},
): { href?: string; label: string | null; newTab: boolean } | null {
  if (!isRecord(link)) return null

  const linkType = resolveLinkType(link.type)
  const href = resolveHrefFromCMSLink(
    {
      type: linkType,
      url: typeof link.url === 'string' ? link.url : null,
      reference: link.reference,
    },
    linkType === 'reference' ? { locale: options.locale ?? 'en' } : undefined,
  )
  const legalSlug = href?.startsWith('/en/') ? href.slice('/en/'.length) : undefined
  const publicHref = !options.locale && isManagedLegalPageSlug(legalSlug) && linkType === 'reference' ? `/${legalSlug}` : href
  if (!publicHref && !(options.allowGroupWithoutHref && linkType === 'group')) return null

  const reference = isRecord(link.reference) ? link.reference.value : null
  const localizedTitle = options.locale && options.locale !== 'en' && linkType === 'reference' && isRecord(reference)
    ? reference.title
    : undefined

  return {
    ...(publicHref ? { href: publicHref } : {}),
    label: typeof localizedTitle === 'string' ? localizedTitle : typeof link.label === 'string' ? link.label : null,
    newTab: linkType === 'group' ? false : typeof link.newTab === 'boolean' ? link.newTab : false,
  }
}

function normalizeFooterGroupItems(links: Array<{ link?: unknown }> | null | undefined, locale?: ContentLocale): UiLinkProps[] {
  return (links ?? [])
    .map((item) => normalizeLinkRecord(item?.link, { locale }))
    .filter((item): item is { href: string; label: string | null; newTab: boolean } => Boolean(item?.href))
    .map((item) => ({
      href: item.href,
      label: item.label,
      newTab: item.newTab,
      appearance: 'inline',
    }))
}

function appendRequiredLegalFooterLinks(items: UiLinkProps[]): UiLinkProps[] {
  const normalizeHrefForComparison = (href: string): string => {
    if (href === '/') return href
    const withoutTrailingSlash = href.replace(/\/+$/, '')
    const normalizedHref = withoutTrailingSlash.length > 0 ? withoutTrailingSlash : '/'
    const legalSlug = getManagedLegalPageSlugFromPath(normalizedHref)
    return legalSlug ? `/${legalSlug}` : (legalRedirectMap.get(normalizedHref) ?? normalizedHref)
  }

  const legalRedirectMap = new Map<string, string>(LEGACY_LEGAL_REDIRECTS.map(({ from, to }) => [from, to]))
  const canonicalizedItems = items.map((item) => {
    const normalizedHref = hrefWithoutTrailingSlash(item.href)
    const redirectedHref = legalRedirectMap.get(normalizedHref)

    if (!redirectedHref) {
      return item
    }

    return {
      ...item,
      href: redirectedHref,
    }
  })
  const deduplicatedItems = canonicalizedItems.filter(
    (item, index, collection) =>
      collection.findIndex(
        (candidate) => normalizeHrefForComparison(candidate.href) === normalizeHrefForComparison(item.href),
      ) === index,
  )
  const existingHrefs = new Set(deduplicatedItems.map((item) => normalizeHrefForComparison(item.href)))
  const missingRequired = REQUIRED_LEGAL_FOOTER_LINKS.filter(
    (item) => !existingHrefs.has(normalizeHrefForComparison(item.href)),
  )

  return [...deduplicatedItems, ...missingRequired]
}

function hrefWithoutTrailingSlash(href: string): string {
  if (href === '/') return href
  const withoutTrailingSlash = href.replace(/\/+$/, '')
  return withoutTrailingSlash.length > 0 ? withoutTrailingSlash : '/'
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
  locale?: ContentLocale,
): FooterNavGroup[] {
  const informationItems = appendRequiredLegalFooterLinks(normalizeFooterGroupItems(data?.informationLinks, locale))

  return [
    { title: 'About', items: normalizeFooterGroupItems(data?.aboutLinks, locale) },
    { title: 'Services', items: normalizeFooterGroupItems(data?.serviceLinks, locale) },
    { title: 'Information', items: informationItems },
  ]
}

/**
 * Normalises header CMS data into a flat-friendly shape that supports optional subItems.
 * Resolves references against the populated documents in the requested locale.
 */
export function normalizeHeaderNavItems(
  data: { navItems?: Array<{ link?: unknown; subItems?: Array<{ link?: unknown }> | null }> | null } | null | undefined,
  locale?: ContentLocale,
): HeaderNavItem[] {
  return (data?.navItems ?? [])
    .map((item) => {
      const resolved = normalizeLinkRecord(item?.link, { allowGroupWithoutHref: true, locale })
      if (!resolved) return null

      const subItems = (item.subItems ?? [])
        .map((sub) => normalizeLinkRecord(sub?.link, { locale }))
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
