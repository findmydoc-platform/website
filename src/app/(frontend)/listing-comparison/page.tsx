import type { ListingCardData } from '@/components/organisms/Listing'
import { clinicFilterOptions, clinicResults } from '@/stories/fixtures/listings'
import { ListingComparisonPageClient } from './ListingComparisonPage.client'

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function ClinicFiltersPage() {
  const results: ListingCardData[] = clinicResults.map((clinic) => {
    const slug = toSlug(clinic.name)

    return {
      ...clinic,
      actions: {
        ...clinic.actions,
        // /clinics/[slug] is intentionally not implemented yet.
        // Keep a stable href to avoid 404s while keeping the UI intact.
        details: { ...clinic.actions.details, href: `#${encodeURIComponent(slug)}` },
      },
    }
  })

  return (
    <ListingComparisonPageClient
      hero={{
        title: 'Compare clinic prices',
        subtitle: 'Transparent pricing for medical treatments near you',
        features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
        bulletStyle: 'circle',
      }}
      filterOptions={clinicFilterOptions}
      results={results}
      trust={{
        title: 'Trust proven quality',
        subtitle: 'We only work with certified clinics and guarantee transparent, up-to-date\npricing information',
        stats: [
          { value: '500+', label: 'Verified clinics', icon: 'users' },
          { value: '1,200+', label: 'Treatment types', icon: 'badgeCheck' },
          { value: '98%', label: 'Satisfaction rate', icon: 'award' },
          { value: 'TÜV', label: 'Verified platform', icon: 'shield' },
        ],
        badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
      }}
    />
  )
}
