import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { headers } from 'next/headers'

import { findFavoriteClinicStateRecord, resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { getListingComparisonServerData } from '@/utilities/listingComparison/serverData'

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
        title: 'Trust proven quality',
        subtitle: 'We only work with certified clinics and guarantee transparent, up-to-date\npricing information',
        stats: [
          { value: listingData.metrics.verifiedClinics, label: verifiedClinicLabel, icon: 'users' },
          { value: listingData.metrics.treatmentTypes, label: treatmentTypesLabel, icon: 'badgeCheck' },
          { value: 98, suffix: '%', label: 'Satisfaction rate', icon: 'award' },
          { valueText: 'TÜV', label: 'Verified platform', icon: 'shield' },
        ],
        badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
      }}
    />
  )
}
