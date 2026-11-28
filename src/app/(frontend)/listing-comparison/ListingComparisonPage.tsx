import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { getListingComparisonTranslator } from '@/features/listingComparison/copy'
import { findFavoriteClinicStateRecord, resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { buildIndexingMetadata, resolveListingComparisonIndexing } from '@/features/searchIndexing'
import { LISTING_COMPARISON_PATHS } from '@/i18n/listingComparisonPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { buildFreshnessMetadata } from '@/utilities/freshness'
import { getCachedListingComparisonServerData } from '@/utilities/listingComparison/serverData'
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
  const listingData = await getCachedListingComparisonServerData(searchParams, locale)
  const indexingPolicy = resolveListingComparisonIndexing(searchParams, locale)

  const t = getListingComparisonTranslator(locale)
  const indexingMetadata = buildIndexingMetadata(indexingPolicy)
  return {
    ...indexingMetadata,
    title: t('title'),
    description: t('subtitle'),
    ...(indexingPolicy.reason === 'canonical-route'
      ? {
          alternates: {
            ...indexingMetadata.alternates,
            languages: { ...LISTING_COMPARISON_PATHS, 'x-default': LISTING_COMPARISON_PATHS.de },
          },
        }
      : {}),
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
  const listingData = await getCachedListingComparisonServerData(searchParams, locale)
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

  const t = getListingComparisonTranslator(locale)
  const { breadcrumbs, selected } = listingData.specialtyContext
  const primarySpecialty = selected[0]
  const specialtySuffix = primarySpecialty
    ? t(selected.length > 1 ? 'specialtyFocusRelated' : 'specialtyFocus', { specialty: primarySpecialty.label })
    : null
  const { verifiedClinics, treatmentTypes, cities, priceEntries } = listingData.metrics
  const trustStats = (
    [
      { value: verifiedClinics, label: t('verifiedClinics', { count: verifiedClinics }), icon: 'hospital' },
      { value: treatmentTypes, label: t('treatmentTypes', { count: treatmentTypes }), icon: 'badgeCheck' },
      { value: cities, label: t('cities', { count: cities }), icon: 'mapPin' },
      { value: priceEntries, label: t('priceEntries', { count: priceEntries }), icon: 'fileText' },
    ] satisfies ListingComparisonTrust['stats']
  ).filter((stat) => stat.value > 0)

  return (
    <>
      <JsonLdScript
        data={buildListingComparisonJsonLd({
          breadcrumbs,
          canonicalPath: indexingPolicy.canonicalPath,
          listName: t('title'),
          clinics: listingData.results,
          isCanonicalRoute: indexingPolicy.reason === 'canonical-route',
        })}
      />
      <ListingComparisonPageClient
        locale={locale}
        hero={{
          title: t('title'),
          subtitle: [t('subtitle'), specialtySuffix].filter(Boolean).join('\n'),
          features: [t('verifiedClinicCount', { count: verifiedClinics }), t('reviewedPrices'), t('freeComparison')],
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
          title: t('trustTitle'),
          subtitle: t('trustDescription'),
          stats: trustStats,
          badges: [t('verifiedProfiles'), t('treatmentTypesBadge'), t('locations'), t('availablePrices')],
          disclaimer: {
            copy: t('disclaimer'),
            accessibleLabel: t('disclaimerRouteLabel'),
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
