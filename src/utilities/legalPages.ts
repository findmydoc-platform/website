export type ManagedLegalPageSlug = 'privacy-policy' | 'imprint'

export type ManagedLegalPageSpec = {
  slug: ManagedLegalPageSlug
  title: string
  metaDescription: string
  footerLabel: string
  placeholderBody: string
}

export const MANAGED_LEGAL_PAGE_SPECS: ManagedLegalPageSpec[] = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    metaDescription: 'Privacy information and data processing details for findmydoc.',
    footerLabel: 'Privacy Policy',
    placeholderBody:
      'This required legal page is ready for editing. Replace this placeholder with the final privacy policy text in Payload CMS.',
  },
  {
    slug: 'imprint',
    title: 'Imprint',
    metaDescription: 'Legal provider information and contact details for findmydoc.',
    footerLabel: 'Imprint',
    placeholderBody:
      'This required legal page is ready for editing. Replace this placeholder with the final imprint information in Payload CMS.',
  },
]

export const MANAGED_LEGAL_PAGE_SLUGS = MANAGED_LEGAL_PAGE_SPECS.map(({ slug }) => slug)

export const REQUIRED_LEGAL_FOOTER_LINKS = MANAGED_LEGAL_PAGE_SPECS.map(({ slug, footerLabel }) => ({
  href: `/${slug}`,
  label: footerLabel,
  newTab: false,
  appearance: 'inline' as const,
}))

export const LEGACY_LEGAL_REDIRECTS = [{ from: '/privacy', to: '/privacy-policy' }] as const

export const REMOVED_LEGAL_PATHS = ['/terms'] as const

export function isManagedLegalPageSlug(slug: unknown): slug is ManagedLegalPageSlug {
  return typeof slug === 'string' && MANAGED_LEGAL_PAGE_SLUGS.includes(slug as ManagedLegalPageSlug)
}

export function getManagedLegalPageSpec(slug: unknown): ManagedLegalPageSpec | null {
  if (!isManagedLegalPageSlug(slug)) return null
  return MANAGED_LEGAL_PAGE_SPECS.find((spec) => spec.slug === slug) ?? null
}
