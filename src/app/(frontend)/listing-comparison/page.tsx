import React from 'react'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import type { ListingCardData } from '@/components/organisms/Listing'
import { clinicFilterOptions, clinicResults } from '@/stories/fixtures/listings'
import { ListingComparisonFilters } from './ListingComparisonFilters.client'

type FilterState = {
  cities: string[]
  waitTimes: Array<{ minWeeks: number; maxWeeks?: number }>
  treatments: string[]
  priceRange: [number, number]
  rating: number | null
}

const applyFilters = (list: ListingCardData[], filters: FilterState) => {
  return list.filter((clinic) => {
    const cityMatch =
      filters.cities.length === 0 ||
      filters.cities.some((city) => clinic.location?.toLowerCase().includes(city.toLowerCase()))

    const treatmentMatch =
      filters.treatments.length === 0 ||
      filters.treatments.some((treatment) =>
        clinic.tags?.some((tag) => tag.toLowerCase().includes(treatment.toLowerCase())),
      )

    const waitTimeMatch = (() => {
      if (filters.waitTimes.length === 0 || !clinic.waitTime) return true
      const numeric = parseFloat(clinic.waitTime)
      if (Number.isNaN(numeric)) return true
      return filters.waitTimes.some((range) => {
        const minOk = numeric >= range.minWeeks
        const maxOk = range.maxWeeks === undefined ? true : numeric <= range.maxWeeks
        return minOk && maxOk
      })
    })()

    const priceMatch = (() => {
      const price = clinic.priceFrom?.value
      if (!price) return true
      return price >= filters.priceRange[0] && price <= filters.priceRange[1]
    })()

    const ratingMatch = (() => {
      if (filters.rating === null) return true
      const value = clinic.rating?.value ?? 0
      return value >= filters.rating
    })()

    return cityMatch && treatmentMatch && waitTimeMatch && priceMatch && ratingMatch
  })
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function ClinicFiltersPage() {
  const [filters, setFilters] = React.useState<FilterState>({
    cities: [],
    waitTimes: [],
    treatments: [],
    priceRange: [1000, 20000],
    rating: null,
  })

  const results: ListingCardData[] = React.useMemo(() => {
    return clinicResults.map((clinic) => {
      const slug = toSlug(clinic.name)

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
  }, [])

  const filteredResults = React.useMemo(() => applyFilters(results, filters), [filters, results])

  return (
    <ListingComparison
      hero={{
        title: 'Compare clinic prices',
        subtitle: 'Transparent pricing for medical treatments near you',
        features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
        bulletStyle: 'circle',
      }}
      filters={
        <ListingComparisonFilters
          cityOptions={clinicFilterOptions.cities}
          waitTimeOptions={clinicFilterOptions.waitTimes}
          treatmentOptions={clinicFilterOptions.treatments}
          onChange={setFilters}
          debounceMs={100}
        />
      }
      results={filteredResults}
      emptyState={
        <div className="border-border bg-card text-muted-foreground rounded-2xl border p-6 text-sm">
          No clinics match these filters.
        </div>
      }
      trust={{
        title: 'Trust proven quality',
        subtitle: 'We only work with certified clinics and guarantee transparent, up-to-date\npricing information',
        stats: [
          { value: '500+', label: 'Verified clinics', Icon: Users },
          { value: '1,200+', label: 'Treatment types', Icon: BadgeCheck },
          { value: '98%', label: 'Satisfaction rate', Icon: Award },
          { value: 'TÜV', label: 'Verified platform', Icon: Shield },
        ],
        badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
      }}
    />
  )
}
