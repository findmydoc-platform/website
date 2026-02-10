import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getListingComparisonServerData } from '@/utilities/listingComparison/serverData'

import { ListingComparisonPageClient } from './ListingComparisonPage.client'

type ListingComparisonPageArgs = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = 'force-dynamic'

export default async function ListingComparisonPage({ searchParams: searchParamsPromise }: ListingComparisonPageArgs) {
  const searchParams = (await searchParamsPromise) ?? {}
  const payload = await getPayload({ config: configPromise })
  const listingData = await getListingComparisonServerData(payload, searchParams)

  const primarySpecialty = listingData.specialtyContext.selected[0]
  const specialtySuffix = primarySpecialty
    ? `Currently focused on ${primarySpecialty.label}${listingData.specialtyContext.selected.length > 1 ? ' and related specialties' : ''}.`
    : ''

  return (
    <ListingComparisonPageClient
      hero={{
        title: 'Compare clinic prices',
        subtitle: `Transparent pricing for medical treatments near you${specialtySuffix ? `\n${specialtySuffix}` : ''}`,
        features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
        bulletStyle: 'circle',
      }}
      filterOptions={listingData.filterOptions}
      priceBounds={listingData.priceBounds}
      queryState={listingData.queryState}
      pagination={listingData.pagination}
      specialtyContext={listingData.specialtyContext}
      results={listingData.results}
      trust={{
        title: 'Trust proven quality',
        subtitle: 'We only work with certified clinics and guarantee transparent, up-to-date\npricing information',
        stats: [
          { value: 500, suffix: '+', label: 'Verified clinics', icon: 'users' },
          { value: 1200, suffix: '+', label: 'Treatment types', icon: 'badgeCheck' },
          { value: 98, suffix: '%', label: 'Satisfaction rate', icon: 'award' },
          { valueText: 'TÜV', label: 'Verified platform', icon: 'shield' },
        ],
        badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
      }}
    />
  )
}
