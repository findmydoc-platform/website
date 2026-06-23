import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { buildBreadcrumbListJsonLd, type BreadcrumbListJsonLd } from '@/utilities/structuredData/breadcrumbs'

export type BreadcrumbJsonLdProps = {
  items: BreadcrumbItem[]
}

function serializeBreadcrumbJsonLd(jsonLd: BreadcrumbListJsonLd): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c')
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = buildBreadcrumbListJsonLd(items)

  if (!jsonLd) return null

  return <script type="application/ld+json">{serializeBreadcrumbJsonLd(jsonLd)}</script>
}
