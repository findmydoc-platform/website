import * as React from 'react'

import { Container } from '@/components/molecules/Container'
import { ListingCard, type ListingCardData } from '@/components/organisms/Listing'
import { FeatureHero, type FeatureHeroProps } from '@/components/organisms/Heroes/FeatureHero'
import { TrustQualitySection, type TrustQualitySectionProps } from '@/components/organisms/TrustQualitySection'

export type ClinicComparisonProps = {
  hero: FeatureHeroProps
  filters: React.ReactNode
  results: ListingCardData[]
  trust: TrustQualitySectionProps
  emptyState?: React.ReactNode
}

export function ClinicComparison({ hero, filters, results, trust, emptyState }: ClinicComparisonProps) {
  return (
    <React.Fragment>
      <a
        href="#clinic-results"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow"
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
                {results.length > 0
                  ? results.map((data) => <ListingCard key={`${data.rank}-${data.name}`} data={data} />)
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
