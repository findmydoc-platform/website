import * as React from 'react'
import { ArrowUpDown } from 'lucide-react'

import { Container } from '@/components/molecules/Container'
import { ListingCard, type ListingCardData } from '@/components/organisms/Listing'
import { FeatureHero, type FeatureHeroProps } from '@/components/organisms/Heroes/FeatureHero'
import { TrustQualitySection, type TrustQualitySectionProps } from '@/components/organisms/TrustQualitySection'

export type ListingComparisonProps = {
  hero: FeatureHeroProps
  filters: React.ReactNode
  results: ListingCardData[]
  trust: TrustQualitySectionProps
  emptyState?: React.ReactNode
  sortControl?: React.ReactNode
}

export function ListingComparison({ hero, filters, results, trust, emptyState, sortControl }: ListingComparisonProps) {
  const resultsCount = results.length
  const resultsLabel = resultsCount === 1 ? 'clinic' : 'clinics'

  const defaultHeader = sortControl ? (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{resultsCount}</span> {resultsLabel}
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
            <div className="grid gap-8 lg:grid-cols-[320px_1fr] lg:items-start">
              <div className="lg:sticky lg:top-6" aria-label="Filters">
                {filters}
              </div>

              <section id="clinic-results" className="space-y-4" aria-label="Clinic results">
                {defaultHeader}
                {results.length > 0
                  ? results.map((data) => <ListingCard key={data.id} data={data} />)
                  : (emptyState ?? null)}
              </section>
            </div>
          </Container>
        </section>

        <TrustQualitySection {...trust} />
      </main>
    </React.Fragment>
  )
}
