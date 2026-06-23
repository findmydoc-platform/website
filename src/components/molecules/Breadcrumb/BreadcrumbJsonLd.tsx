import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { JsonLdScript, buildBreadcrumbListJsonLd } from '@/utilities/structuredData'

export type BreadcrumbJsonLdProps = {
  items: BreadcrumbItem[]
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = buildBreadcrumbListJsonLd(items)

  return <JsonLdScript data={jsonLd} />
}
