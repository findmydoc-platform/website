import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { findFavoriteClinicStateRecord, resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { buildIndexingMetadata, resolveListingComparisonIndexing } from '@/features/searchIndexing'
import { LISTING_COMPARISON_PATHS } from '@/i18n/listingComparisonPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { buildFreshnessMetadata } from '@/utilities/freshness'
import { getCachedListingComparisonServerData } from '@/utilities/listingComparison/serverData'
import { DISCLAIMER_COPY } from '@/utilities/legal/disclaimers'
import { JsonLdScript, buildListingComparisonJsonLd } from '@/utilities/structuredData'

import type { ListingComparisonTrust } from './ListingComparisonPage.client'
import { ListingComparisonPageClient } from './ListingComparisonPage.client'

export type ListingComparisonPageArgs = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export async function listingComparisonMetadata(
  { searchParams: searchParamsPromise }: ListingComparisonPageArgs,
  locale: UiCopyLocale,
): Promise<Metadata> {
  const searchParams = (await searchParamsPromise) ?? {}
  const listingData = await getCachedListingComparisonServerData(searchParams)
  const indexingPolicy = resolveListingComparisonIndexing(searchParams, locale)

  return {
    ...buildIndexingMetadata(indexingPolicy),
    ...buildFreshnessMetadata(listingData.freshness),
  }
}

export async function renderListingComparisonPage(
  { searchParams: searchParamsPromise }: ListingComparisonPageArgs,
  locale: UiCopyLocale,
) {
  const searchParams = (await searchParamsPromise) ?? {}
  const requestHeaders = await headers()
  const payload = await getPayload({ config: configPromise })
  const listingData = await getCachedListingComparisonServerData(searchParams)
  const indexingPolicy = resolveListingComparisonIndexing(searchParams, locale)
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

  const breadcrumbs = listingData.specialtyContext.breadcrumbs.map((item) => ({
    ...item,
    href:
      item.href === LISTING_COMPARISON_PATHS.de || item.href.startsWith(`${LISTING_COMPARISON_PATHS.de}?`)
        ? item.href.replace(LISTING_COMPARISON_PATHS.de, LISTING_COMPARISON_PATHS[locale])
        : item.href,
  }))
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
      { value: listingData.metrics.verifiedClinics, label: verifiedClinicLabel, icon: 'hospital' },
      { value: listingData.metrics.treatmentTypes, label: treatmentTypesLabel, icon: 'badgeCheck' },
      { value: listingData.metrics.cities, label: citiesLabel, icon: 'mapPin' },
      { value: listingData.metrics.priceEntries, label: priceEntriesLabel, icon: 'fileText' },
    ] satisfies ListingComparisonTrust['stats']
  ).filter((stat) => stat.value > 0)

  return (
    <>
      <JsonLdScript
        data={buildListingComparisonJsonLd({
          breadcrumbs,
          clinics: listingData.results,
          isCanonicalRoute: indexingPolicy.reason === 'canonical-route',
        })}
      />
      <ListingComparisonPageClient
        locale={locale}
        hero={{
          title: locale === 'de' ? 'Klinikpreise vergleichen' : 'Compare clinic prices',
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
        specialtyContext={{ ...listingData.specialtyContext, breadcrumbs }}
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
          disclaimer: {
            copy: DISCLAIMER_COPY.comparisonPages,
            routeLabel: 'Comparison pages',
            variant: 'inline-note',
            surface: 'muted',
            size: 'compact',
            showVariantLabel: false,
          },
        }}
      />
    </>
  )
}
