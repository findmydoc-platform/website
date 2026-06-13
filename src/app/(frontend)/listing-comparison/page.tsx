import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { headers } from 'next/headers'

import { findFavoriteClinicStateRecord, resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { getListingComparisonServerData } from '@/utilities/listingComparison/serverData'

import type { ListingComparisonTrust } from './ListingComparisonPage.client'
import { ListingComparisonPageClient } from './ListingComparisonPage.client'

type ListingComparisonPageArgs = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = 'force-dynamic'

export default async function ListingComparisonPage({ searchParams: searchParamsPromise }: ListingComparisonPageArgs) {
  const searchParams = (await searchParamsPromise) ?? {}
  const requestHeaders = await headers()
  const payload = await getPayload({ config: configPromise })
  const listingData = await getListingComparisonServerData(payload, searchParams)
  const favoriteAuthContext = await resolveFavoriteClinicAuthContext({
    payload,
    headers: requestHeaders,
  })
  const favoriteClinicIds = listingData.results.map((result) => Number(result.id)).filter((id) => Number.isFinite(id))
  const favoriteStateByClinicId = favoriteAuthContext.patient
    ? await findFavoriteClinicStateRecord({
        payload,
        patientId: favoriteAuthContext.patient.id,
        clinicIds: favoriteClinicIds,
      })
    : {}

  const primarySpecialty = listingData.specialtyContext.selected[0]
  const specialtySuffix = primarySpecialty
    ? `Currently focused on ${primarySpecialty.label}${listingData.specialtyContext.selected.length > 1 ? ' and related specialties' : ''}.`
    : ''
  const verifiedClinicLabel = listingData.metrics.verifiedClinics === 1 ? 'verified clinic' : 'verified clinics'
  const treatmentTypesLabel = listingData.metrics.treatmentTypes === 1 ? 'treatment type' : 'treatment types'
  const citiesLabel = listingData.metrics.cities === 1 ? 'city' : 'cities'
  const priceEntriesLabel = listingData.metrics.priceEntries === 1 ? 'price entry' : 'price entries'
  const trustStats = (
    [
      { value: listingData.metrics.verifiedClinics, label: verifiedClinicLabel, icon: 'users' },
      { value: listingData.metrics.treatmentTypes, label: treatmentTypesLabel, icon: 'badgeCheck' },
      { value: listingData.metrics.cities, label: citiesLabel, icon: 'mapPin' },
      { value: listingData.metrics.priceEntries, label: priceEntriesLabel, icon: 'fileText' },
    ] satisfies ListingComparisonTrust['stats']
  ).filter((stat) => stat.value > 0)

  return (
    <ListingComparisonPageClient
      hero={{
        title: 'Compare clinic prices',
        subtitle: `Transparent pricing for medical treatments near you${specialtySuffix ? `\n${specialtySuffix}` : ''}`,
        features: [
          `${listingData.metrics.verifiedClinics} ${verifiedClinicLabel}`,
          'Reviewed prices',
          'Free comparison',
        ],
        bulletStyle: 'circle',
      }}
      filterOptions={listingData.filterOptions}
      priceBounds={listingData.priceBounds}
      queryState={listingData.queryState}
      pagination={listingData.pagination}
      specialtyContext={listingData.specialtyContext}
      results={listingData.results}
      favorites={{
        isPatient: favoriteAuthContext.isPatient,
        favoriteStateByClinicId,
      }}
      trust={{
        title: 'A clearer way to compare clinics',
        subtitle:
          'We make clinic profiles easier to compare by showing key treatment, location, and price fields in one place.',
        stats: trustStats,
        badges: ['Verified clinic profiles', 'Treatment types', 'Locations', 'Price fields where available'],
      }}
    />
  )
}
