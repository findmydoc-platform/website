import * as React from 'react'
import { ArrowUpDown } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Container } from '@/components/molecules/Container'
import { ListingCard, type ListingCardData } from '@/components/organisms/Listing'
import { FeatureHero, type FeatureHeroProps } from '@/components/organisms/Heroes/FeatureHero'
import { TrustQualitySection, type TrustQualitySectionProps } from '@/components/organisms/TrustQualitySection'
import { ListingFiltersJumpBar } from './ListingFiltersJumpBar.client'

export type ListingComparisonProps = {
  hero: FeatureHeroProps
  filters: React.ReactNode
  results: ListingCardData[]
  totalResultsCount?: number
  trust: TrustQualitySectionProps
  emptyState?: React.ReactNode
  sortControl?: React.ReactNode
  resultsContext?: React.ReactNode
  resultsFooter?: React.ReactNode
}

export function ListingComparison({
  hero,
  filters,
  results,
  totalResultsCount,
  trust,
  emptyState,
  sortControl,
  resultsContext,
  resultsFooter,
}: ListingComparisonProps) {
  const filtersContainerId = 'listing-comparison-filters'
  const visibleCount = results.length
  const totalCount = totalResultsCount ?? visibleCount
  const resultsLabel = totalCount === 1 ? 'Clinic' : 'Clinics'

  const defaultHeader = sortControl ? (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{visibleCount}</span> of{' '}
        <span className="font-semibold text-foreground">{totalCount}</span> {resultsLabel}
      </p>
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        {sortControl}
      </div>
    </div>
  ) : null
  return (
    <React.Fragment>
      <a
        href="#clinic-results"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow"
      >
        Skip to results
      </a>

      <FeatureHero {...hero} />

      <main>
        <section className="bg-muted/30 py-12" aria-label="Clinic filters and results">
          <Container>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
              <div id={filtersContainerId} className="order-2 min-w-0 lg:order-1" aria-label="Filters">
                {filters}
              </div>

              <section id="clinic-results" className="order-1 min-w-0 space-y-4 lg:order-2" aria-label="Clinic results">
                {resultsContext}
                <div className="flex justify-end lg:hidden">
                  <Button asChild variant="secondary" className="min-h-11 rounded-full px-5">
                    <a href={`#${filtersContainerId}`}>Jump to filters</a>
                  </Button>
                </div>
                {defaultHeader}
                {results.length > 0
                  ? results.map((data) => <ListingCard key={data.id} data={data} />)
                  : (emptyState ?? null)}
                {resultsFooter}
              </section>
            </div>
          </Container>
          <ListingFiltersJumpBar targetId={filtersContainerId} />
        </section>

        <TrustQualitySection {...trust} />
      </main>
    </React.Fragment>
  )
}
