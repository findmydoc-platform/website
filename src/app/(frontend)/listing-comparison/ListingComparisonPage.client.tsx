'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BadgeCheck, FileText, Hospital, MapPin } from 'lucide-react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { FavoriteClinicAction } from '@/features/favorites/FavoriteClinicAction.client'
import { buildPatientLoginHref } from '@/features/favorites/redirects'
import { useLanguageSwitchRoute } from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import { getListingComparisonTranslator } from '@/features/listingComparison/copy'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { SortControl } from '@/components/molecules/SortControl'
import { Pagination } from '@/components/molecules/Pagination'
import { Breadcrumb } from '@/components/molecules/Breadcrumb'
import {
  LISTING_COMPARISON_PRICE_MAX_DEFAULT,
  LISTING_COMPARISON_PRICE_MIN_DEFAULT,
  type ListingComparisonQueryState,
} from '@/utilities/listingComparison/queryState'
import { SORT_OPTIONS, type SortOption } from '@/utilities/listingComparison/sort'
import { normalizePriceBounds, type PriceBounds } from '@/utilities/listingComparison/priceRange'
import { ListingComparisonFilters } from './ListingComparisonFilters.client'
import { useListingComparisonUrlState } from './useListingComparisonUrlState'
import { useListingResultImpressions } from './useListingResultImpressions'
import { useTreatmentSearchHandoff } from './TreatmentSearchHandoff.client'

type ListingComparisonTrustStatInput =
  | {
      label: string
      icon: 'hospital' | 'badgeCheck' | 'mapPin' | 'fileText'
      value: number
      prefix?: string
      suffix?: string
      decimals?: number
      locale?: string
    }
  | {
      label: string
      icon: 'hospital' | 'badgeCheck' | 'mapPin' | 'fileText'
      valueText: string
    }

type ListingFilterOption = {
  value: string
  label: string
  disabled?: boolean
}

type ListingSpecialtyOption = ListingFilterOption & {
  depth: number
  parentValue: string | null
}

type ListingTreatmentOption = ListingFilterOption & {
  plainLabel: string
  searchLabels?: string[]
}

type ListingTreatmentGroup = {
  specialty: ListingSpecialtyOption
  options: ListingTreatmentOption[]
}

type ListingComparisonPagination = {
  page: number
  perPage: number
  totalPages: number
  totalResults: number
  totalAvailableResults: number
}

type ListingComparisonSpecialtyContext = {
  selected: ListingSpecialtyOption[]
  breadcrumbs: Array<{ label: string; href: string }>
}

export type ListingComparisonTrust = {
  title: string
  subtitle: string
  stats: ListingComparisonTrustStatInput[]
  badges: string[]
  disclaimer?: {
    copy: React.ReactNode
    accessibleLabel?: string
    variant?: 'inline-note' | 'slim-notice-bar' | 'collapsible-disclosure'
    surface?: 'light' | 'muted'
    size?: 'default' | 'compact'
    title?: string
    showVariantLabel?: boolean
  }
}

export type ListingComparisonPageClientProps = {
  locale: UiCopyLocale
  hero: {
    title: string
    subtitle: string
    features: string[]
    bulletStyle: 'circle' | 'check'
  }
  trust: ListingComparisonTrust | null
  results: ListingCardData[]
  favorites: {
    isPatient: boolean
    favoriteStateByClinicId: Record<string, number>
  }
  filterOptions: {
    cities: ListingFilterOption[]
    waitTimes: Array<{ label: string; minWeeks: number; maxWeeks?: number }>
    specialties: ListingSpecialtyOption[]
    treatments: ListingTreatmentGroup[]
  }
  priceBounds: PriceBounds
  queryState: ListingComparisonQueryState
  pagination: ListingComparisonPagination
  specialtyContext: ListingComparisonSpecialtyContext
}

const iconMap = {
  hospital: Hospital,
  badgeCheck: BadgeCheck,
  mapPin: MapPin,
  fileText: FileText,
} satisfies Record<ListingComparisonTrustStatInput['icon'], React.ComponentType>

const sortLabelKeys = {
  rank: 'sortRank',
  'price-asc': 'sortPriceAscending',
  'price-desc': 'sortPriceDescending',
  'rating-desc': 'sortHighestRated',
  'name-asc': 'sortName',
} as const satisfies Record<SortOption, string>

export function ListingComparisonPageClient({
  locale,
  hero,
  trust,
  results,
  favorites,
  filterOptions,
  priceBounds,
  queryState,
  pagination,
  specialtyContext,
}: ListingComparisonPageClientProps) {
  const t = getListingComparisonTranslator(locale)
  const sortOptions = React.useMemo(
    () => SORT_OPTIONS.map(({ value }) => ({ value, label: t(sortLabelKeys[value]) })),
    [t],
  )
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPath = React.useMemo(() => {
    const query = searchParams.toString()
    return `${pathname}${query ? `?${query}` : ''}`
  }, [pathname, searchParams])
  const loginHref = React.useMemo(() => buildPatientLoginHref(currentPath, locale), [currentPath, locale])
  const normalizedPriceBounds = React.useMemo(
    () =>
      normalizePriceBounds(priceBounds, {
        min: LISTING_COMPARISON_PRICE_MIN_DEFAULT,
        max: LISTING_COMPARISON_PRICE_MAX_DEFAULT,
      }),
    [priceBounds],
  )
  const {
    sortSelection,
    setSortSelection,
    setFilterDraft,
    filterResetSignature,
    resultViewSignature,
    buildPageHref,
    clearSpecialtySelection,
    buildLanguageSwitchHref,
    cancelPendingFilterUpdate,
  } = useListingComparisonUrlState({
    locale,
    queryState,
    priceBounds: normalizedPriceBounds,
  })
  const [treatmentSearch, setTreatmentSearch] = React.useState('')
  const pendingTreatmentSearch = useTreatmentSearchHandoff()
  const handoffTreatmentSearch = React.useCallback(
    (href: string) => {
      cancelPendingFilterUpdate()
      if (!pendingTreatmentSearch) return
      pendingTreatmentSearch.current = treatmentSearch ? { href, value: treatmentSearch } : null
    },
    [cancelPendingFilterUpdate, pendingTreatmentSearch, treatmentSearch],
  )
  useLanguageSwitchRoute({
    locale,
    targets: {
      de: buildLanguageSwitchHref('de'),
      en: buildLanguageSwitchHref('en'),
    },
    onNavigate: handoffTreatmentSearch,
  })

  React.useLayoutEffect(() => {
    const handoff = pendingTreatmentSearch?.current
    if (!handoff || handoff.href !== currentPath) return
    setTreatmentSearch(handoff.value)
    pendingTreatmentSearch.current = null
  }, [currentPath, pendingTreatmentSearch])

  const onResultElement = useListingResultImpressions(resultViewSignature)

  const specialtyChipLabel = React.useMemo(() => {
    if (specialtyContext.selected.length === 0) return null
    return specialtyContext.selected[0]?.label ?? null
  }, [specialtyContext.selected])

  return (
    <ListingComparison
      hero={hero}
      locale={locale}
      copy={{
        skipToResults: t('skipToResults'),
        filtersAndResults: t('filtersAndResults'),
        filters: t('filters'),
        results: t('results'),
        resultCount: t('resultCount', { visible: results.length, total: pagination.totalResults }),
        jumpToFilters: t('jumpToFilters'),
      }}
      filters={
        <ListingComparisonFilters
          key={filterResetSignature}
          locale={locale}
          treatmentSearchValue={treatmentSearch}
          onTreatmentSearchChange={setTreatmentSearch}
          cityOptions={filterOptions.cities}
          waitTimeOptions={filterOptions.waitTimes}
          specialtyOptions={filterOptions.specialties}
          treatmentGroups={filterOptions.treatments}
          priceBounds={normalizedPriceBounds}
          initialValues={{
            cities: queryState.cities,
            specialty: queryState.specialties[0] ?? null,
            treatments: queryState.treatments,
            waitTimes: [],
            priceRange: [queryState.priceMin, queryState.priceMax],
            rating: queryState.ratingMin,
          }}
          onChange={(nextFilters) => {
            setFilterDraft({
              cities: nextFilters.cities,
              specialty: nextFilters.specialty,
              treatments: nextFilters.treatments,
              priceRange: nextFilters.priceRange,
              rating: nextFilters.rating,
            })
          }}
        />
      }
      totalResultsCount={pagination.totalResults}
      results={results}
      onResultElement={onResultElement}
      renderResultCornerAction={(data) => {
        const clinicId = Number(data.id)
        if (!Number.isFinite(clinicId)) return null

        return (
          <FavoriteClinicAction
            clinicId={clinicId}
            clinicName={data.name}
            locale={locale}
            initialFavoriteId={favorites.favoriteStateByClinicId[String(clinicId)] ?? null}
            isPatient={favorites.isPatient}
            loginHref={loginHref}
            variant="icon"
          />
        )
      }}
      resultsContext={
        specialtyContext.breadcrumbs.length > 0 ? (
          <Breadcrumb label={t('breadcrumb')} items={specialtyContext.breadcrumbs} />
        ) : null
      }
      sortControl={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {specialtyChipLabel ? (
            <button
              type="button"
              onClick={() => {
                setTreatmentSearch('')
                clearSpecialtySelection()
              }}
              className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              title={t('removeSpecialtyTitle')}
              aria-label={t('removeSpecialty', { specialty: specialtyChipLabel })}
            >
              {t('specialtyChip', { specialty: specialtyChipLabel })} ×
            </button>
          ) : null}
          <SortControl label={t('sort')} value={sortSelection} onValueChange={setSortSelection} options={sortOptions} />
        </div>
      }
      emptyState={
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t('noClinics')}
        </div>
      }
      resultsFooter={
        pagination.totalPages > 1 ? (
          <Pagination
            copy={{
              label: t('pagination'),
              next: t('nextPage'),
              previous: t('previousPage'),
              nextLabel: t('nextPageLabel'),
              previousLabel: t('previousPageLabel'),
            }}
            page={pagination.page}
            totalPages={pagination.totalPages}
            getPathForPage={buildPageHref}
            onNavigate={(href) => router.push(href, { scroll: false })}
          />
        ) : null
      }
      trust={
        trust && trust.stats.length >= 3
          ? {
              ...trust,
              numberLocale: locale,
              stats: trust.stats.map((stat) => {
                const Icon = iconMap[stat.icon]

                if ('valueText' in stat) {
                  return {
                    label: stat.label,
                    valueText: stat.valueText,
                    Icon,
                  }
                }

                return {
                  label: stat.label,
                  value: stat.value,
                  prefix: stat.prefix,
                  suffix: stat.suffix,
                  decimals: stat.decimals,
                  locale: stat.locale,
                  Icon,
                }
              }),
            }
          : null
      }
    />
  )
}
