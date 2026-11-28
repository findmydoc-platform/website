import type { FooterNavGroup, HeaderNavItem } from '@/utilities/normalizeNavItems'
import type { UiLinkProps } from '@/components/molecules/Link'
import { buildPagePath } from '@/utilities/cachePolicy'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { getManagedLegalPageSlugFromPath, type ManagedLegalPageSlug } from '@/utilities/legalPages'
import { temporaryLandingLocaleFromPath, type TemporaryLandingLocale } from './i18n'

type HoldingLegalLink = { href: string; label: string }
export type HoldingLegalLinks = Partial<Record<ManagedLegalPageSlug, HoldingLegalLink>>

export const getHoldingLegalLinkLocale = (pathname: string): TemporaryLandingLocale =>
  temporaryLandingLocaleFromPath(pathname) ?? (pathname.startsWith('/en/') ? 'en' : 'de')

export function resolveHoldingLegalLinks(
  links: UiLinkProps[],
  locale: TemporaryLandingLocale,
  german: readonly string[],
  english: readonly string[],
): HoldingLegalLinks {
  const destinations: HoldingLegalLinks = {}
  const published = { de: german, en: english }
  const localeOrder: ContentLocale[] = locale === 'en' ? ['en', 'de'] : ['de', 'en']
  for (const link of links) {
    const slug = getManagedLegalPageSlugFromPath(link.href)
    if (!slug || !link.label) continue

    const actualLocale = localeOrder.find((candidate) => published[candidate].includes(slug))
    if (!actualLocale) continue

    destinations[slug] = {
      href: buildPagePath(slug, actualLocale),
      label: actualLocale === locale ? link.label : `${link.label} (${actualLocale.toUpperCase()})`,
    }
  }

  return destinations
}

export type HoldingPublicDestination =
  'blog-article' | 'blog-index' | 'blog-pagination' | 'contact' | 'holding-home' | 'imprint' | 'privacy'

const normalizeSiteOrigin = (siteOrigin: string): string | null => {
  try {
    const url = new URL(siteOrigin)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

const normalizePathname = (pathname: string): string => {
  if (pathname === '/') return pathname
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

export const classifyHoldingPublicDestination = (href: string, siteOrigin: string): HoldingPublicDestination | null => {
  const expectedOrigin = normalizeSiteOrigin(siteOrigin)
  if (!expectedOrigin) return null

  let url: URL
  try {
    url = new URL(href, expectedOrigin)
  } catch {
    return null
  }

  if (url.origin !== expectedOrigin) return null

  if (url.username || url.password) return null

  let decodedPathname: string
  try {
    decodedPathname = decodeURIComponent(url.pathname)
  } catch {
    return null
  }

  const pathname = normalizePathname(decodedPathname)
  if (temporaryLandingLocaleFromPath(pathname)) return 'holding-home'
  if (pathname === '/posts') return 'blog-index'
  if (/^\/posts\/page\/[1-9]\d*$/.test(pathname)) return 'blog-pagination'
  if (/^\/posts\/[^/]+$/.test(pathname)) return 'blog-article'
  if (pathname === '/contact') return 'contact'
  const legalSlug = getManagedLegalPageSlugFromPath(pathname)
  if (legalSlug) return legalSlug === 'privacy-policy' ? 'privacy' : 'imprint'

  return null
}

function projectHoldingLink<T extends { href: string }>(
  link: T,
  siteOrigin: string,
  legalLinks?: HoldingLegalLinks,
): T | null {
  const destination = classifyHoldingPublicDestination(link.href, siteOrigin)
  if (!destination) return null
  if (!legalLinks || (destination !== 'privacy' && destination !== 'imprint')) return link

  const localizedLink = legalLinks[destination === 'privacy' ? 'privacy-policy' : 'imprint']
  return localizedLink ? { ...link, ...localizedLink } : null
}

export const projectHoldingHeaderNavItems = (
  items: HeaderNavItem[],
  siteOrigin: string,
  legalLinks?: HoldingLegalLinks,
): HeaderNavItem[] =>
  items.flatMap((item) => {
    const primary = item.href ? projectHoldingLink({ ...item, href: item.href }, siteOrigin, legalLinks) : null
    const subItems = item.subItems
      ?.map((subItem) => projectHoldingLink(subItem, siteOrigin, legalLinks))
      .filter((subItem) => subItem !== null)

    if (!primary && (!subItems || subItems.length === 0)) return []

    return [
      {
        ...item,
        ...primary,
        href: primary?.href,
        subItems: subItems?.length ? subItems : undefined,
      },
    ]
  })

export const projectHoldingFooterLinks = (
  links: UiLinkProps[],
  siteOrigin: string,
  legalLinks?: HoldingLegalLinks,
): UiLinkProps[] =>
  links.map((link) => projectHoldingLink(link, siteOrigin, legalLinks)).filter((link) => link !== null)

export const projectHoldingFooterGroups = (
  groups: FooterNavGroup[],
  siteOrigin: string,
  legalLinks?: HoldingLegalLinks,
): FooterNavGroup[] =>
  groups
    .map((group) => ({
      ...group,
      items: projectHoldingFooterLinks(group.items, siteOrigin, legalLinks),
    }))
    .filter((group) => group.items.length > 0)
