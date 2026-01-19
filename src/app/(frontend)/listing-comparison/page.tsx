import type { ListingCardData } from '@/components/organisms/Listing'
import { slugify } from '@/utilities/slugify'
import {
  listingComparisonFilterOptions,
  listingComparisonResultsPlaceholder,
} from '@/utilities/placeholders/listingComparison'

// TODO: The data above is temporary and should be replaced with backend
// integration. When the listing comparison API is available, remove the
// placeholder file and wire this page to fetch real data instead.
import { ListingComparisonPageClient } from './ListingComparisonPage.client'

export default function ListingComparisonPage() {
  const results: ListingCardData[] = listingComparisonResultsPlaceholder.map((clinic) => {
    const slug = slugify(clinic.name)

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
      filterOptions={listingComparisonFilterOptions}
      results={results}
      trust={{
        title: 'Trust proven quality',
        subtitle: 'We only work with certified clinics and guarantee transparent, up-to-date\npricing information',
        stats: [
          { value: 500, suffix: '+', label: 'Verified clinics', Icon: Users },
          { value: 1200, suffix: '+', label: 'Treatment types', Icon: BadgeCheck },
          { value: 98, suffix: '%', label: 'Satisfaction rate', Icon: Award },
          { valueText: 'TÜV', label: 'Verified platform', Icon: Shield },
        ],
        badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
      }}
    />
  )
}
