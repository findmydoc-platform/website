import type { getPublicChromeCopy } from '@/features/uiCopy/publicChrome'
import type { HoldingLegalLinks } from '@/features/temporaryLandingMode/navigation'
import { isTemporaryLandingPublicExemptPath } from '@/features/temporaryLandingMode'
import { publicNavigationPaths } from '@/i18n/publicNavigationPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { getManagedLegalPageSlugFromPath } from '@/utilities/legalPages'
import type { FooterNavGroup, HeaderNavItem } from '@/utilities/normalizeNavItems'

type ChromeCopy = ReturnType<typeof getPublicChromeCopy>

function resolveFixedDestination(href: string, locale: UiCopyLocale, holding: boolean) {
  const suffixStart = href.search(/[?#]/)
  const path = suffixStart < 0 ? href : href.slice(0, suffixStart)
  const suffix = suffixStart < 0 ? '' : href.slice(suffixStart)
  const route = Object.entries(publicNavigationPaths).find(([de, { en }]) => de === path || en === path)
  if (!route) return undefined

  const [de, { en }] = route
  const englishAvailable = en && (!holding || isTemporaryLandingPublicExemptPath(en))
  const localized = locale === 'en' && englishAvailable ? en : de
  return { key: de, href: localized + suffix, hrefLang: localized === en ? 'en' : 'de' }
}

export const resolveAccountHref = (href: string, locale: UiCopyLocale) =>
  resolveFixedDestination(href, locale, false)?.href ?? href

export function localizePublicNavigation({
  headerItems,
  footerGroups,
  locale,
  holding,
  copy,
  legalLinks,
}: {
  headerItems: HeaderNavItem[]
  footerGroups: FooterNavGroup[]
  locale: UiCopyLocale
  holding: boolean
  copy: ChromeCopy
  legalLinks: HoldingLegalLinks
}) {
  function localizeLink<T extends { href?: string; label?: string | null }>(link: T): T | null {
    if (!link.href) return link
    const legalSlug = getManagedLegalPageSlugFromPath(link.href)
    if (legalSlug) {
      const published = legalLinks[legalSlug]
      if (!published) return null
      const hrefLang = published.href.startsWith('/en/') ? 'en' : 'de'
      return {
        ...link,
        href: published.href,
        hrefLang,
        label: holding
          ? published.label
          : copy.labels[`/${legalSlug}`] + (hrefLang === locale ? '' : ` (${hrefLang.toUpperCase()})`),
      }
    }
    const fixed = resolveFixedDestination(link.href, locale, holding)
    if (!fixed) return link

    const label = (copy.labels as Record<string, string>)[fixed.key]
    return { ...link, href: fixed.href, hrefLang: fixed.hrefLang, label: label ?? link.label }
  }

  return {
    headerItems: headerItems.flatMap((item) => {
      const subItems = item.subItems?.flatMap((subItem) => localizeLink(subItem) ?? [])
      const localized = localizeLink(item)
      if (!localized && !subItems?.length) return []
      return [{ ...item, ...localized, href: localized?.href, subItems }]
    }),
    footerGroups: footerGroups
      .map((group) => ({
        title: copy.footerGroups[group.title as keyof ChromeCopy['footerGroups']] ?? group.title,
        items: group.items.flatMap((item) => localizeLink(item) ?? []),
      }))
      .filter((group) => group.items.length > 0),
  }
}
