import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { getAbsoluteSiteURL } from '@/utilities/socialPreview'

export type BreadcrumbListJsonLd = {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }>
}

export function buildBreadcrumbListJsonLd(items: BreadcrumbItem[]): BreadcrumbListJsonLd | null {
  const normalizedItems = items
    .map((item) => ({
      label: item.label.trim(),
      href: item.href.trim(),
    }))
    .filter((item) => item.label.length > 0 && item.href.length > 0)

  if (normalizedItems.length < 2) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: normalizedItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: getAbsoluteSiteURL(item.href),
    })),
  }
}
