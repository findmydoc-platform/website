import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { buildBreadcrumbListJsonLd } from '@/utilities/structuredData/breadcrumbs'

export type BreadcrumbJsonLdProps = {
  items: BreadcrumbItem[]
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = buildBreadcrumbListJsonLd(items)

  if (!jsonLd) return null

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd),
      }}
    />
  )
}
