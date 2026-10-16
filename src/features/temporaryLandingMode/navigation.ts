import type { FooterNavGroup, HeaderNavItem } from '@/utilities/normalizeNavItems'
import type { UiLinkProps } from '@/components/molecules/Link'

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
  if (pathname === '/') return 'holding-home'
  if (pathname === '/posts') return 'blog-index'
  if (/^\/posts\/page\/[1-9]\d*$/.test(pathname)) return 'blog-pagination'
  if (/^\/posts\/[^/]+$/.test(pathname)) return 'blog-article'
  if (pathname === '/contact') return 'contact'
  if (pathname === '/privacy-policy' || pathname === '/privacy') return 'privacy'
  if (pathname === '/imprint') return 'imprint'

  return null
}

export const projectHoldingHeaderNavItems = (items: HeaderNavItem[], siteOrigin: string): HeaderNavItem[] =>
  items.flatMap((item) => {
    const href = item.href && classifyHoldingPublicDestination(item.href, siteOrigin) ? item.href : undefined
    const subItems = item.subItems?.filter((subItem) => classifyHoldingPublicDestination(subItem.href, siteOrigin))

    if (!href && (!subItems || subItems.length === 0)) return []

    return [
      {
        ...item,
        ...(href ? { href } : { href: undefined }),
        ...(subItems && subItems.length > 0 ? { subItems } : { subItems: undefined }),
      },
    ]
  })

export const projectHoldingFooterLinks = (links: UiLinkProps[], siteOrigin: string): UiLinkProps[] =>
  links.filter((item) => classifyHoldingPublicDestination(item.href, siteOrigin))

export const projectHoldingFooterGroups = (groups: FooterNavGroup[], siteOrigin: string): FooterNavGroup[] =>
  groups
    .map((group) => ({
      ...group,
      items: projectHoldingFooterLinks(group.items, siteOrigin),
    }))
    .filter((group) => group.items.length > 0)
