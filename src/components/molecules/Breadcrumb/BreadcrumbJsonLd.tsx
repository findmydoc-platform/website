import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { buildBreadcrumbListJsonLd } from '@/utilities/structuredData/breadcrumbs'

export type BreadcrumbJsonLdProps = {
  items: BreadcrumbItem[]
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = buildBreadcrumbListJsonLd(items)

  if (!jsonLd) return null

  const jsonLdText = JSON.stringify(jsonLd).replace(/</g, '\\u003c')

  return <script type="application/ld+json">{jsonLdText}</script>
}
