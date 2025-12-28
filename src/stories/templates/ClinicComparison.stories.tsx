import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { within, userEvent, waitFor } from '@storybook/testing-library'
import * as React from 'react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ClinicComparison } from '@/components/templates/ClinicComparison/Component'
import { ClinicComparisonFilters } from '@/app/(frontend)/clinic-filters/ClinicComparisonFilters.client'

import { clinicFilterOptions, clinicResults, clinicTrust, makeClinicList } from '@/stories/fixtures/clinics'

import medicalHero from '@/stories/assets/medical-hero.jpg'

const meta = {
  title: 'Templates/ClinicComparison',
  component: ClinicComparison,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ClinicComparison>

export default meta
type Story = StoryObj<typeof meta>

const baseHero = {
  title: 'Compare clinic prices',
  subtitle: 'Transparent pricing for medical treatments near you',
  features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
  bulletStyle: 'circle' as const,
}

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

type TemplateArgs = React.ComponentProps<typeof ClinicComparison>

const FilterHarness: React.FC<TemplateArgs> = ({ hero, trust, results = [], emptyState }) => {
  const [filters, setFilters] = React.useState<FilterState>({
    cities: [],
    waitTimes: [],
    treatments: [],
    priceRange: [1000, 20000],
    rating: null,
  })

  const filteredResults = React.useMemo(() => applyFilters(results, filters), [filters, results])

  return (
    <ClinicComparison
      hero={hero}
      filters={
        <ClinicComparisonFilters
          cityOptions={clinicFilterOptions.cities}
          waitTimeOptions={clinicFilterOptions.waitTimes}
          treatmentOptions={clinicFilterOptions.treatments}
          onChange={setFilters}
          debounceMs={100}
        />
      }
      results={filteredResults}
      emptyState={
        emptyState ?? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No clinics match these filters.
          </div>
        )
      }
      trust={trust}
    />
  )
}

const sampleResults: ListingCardData[] = clinicResults

export const Default: Story = {
  args: {
    hero: {
      ...baseHero,
      media: {
        src: medicalHero,
        alt: 'Bright hospital waiting area',
      },
    },
    filters: undefined,
    results: sampleResults,
    trust: clinicTrust,
  },
  render: (args) => <FilterHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Skip link exists (accessibility)
    expect(canvas.getByRole('link', { name: /skip to results/i })).toBeInTheDocument()

    // Results render
    expect(canvas.getByLabelText(/clinic results/i)).toBeInTheDocument()
    expect(canvas.getByText('Ring Clinic')).toBeInTheDocument()

    // Filters interaction narrows results (city filter)
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Berlin' }))

    await waitFor(() => {
      expect(canvas.queryByText('Ring Clinic')).not.toBeInTheDocument()
      expect(canvas.getByText('Berlin University Hospital')).toBeInTheDocument()
    })
  },
}

export const EmptyResults: Story = {
  args: {
    hero: baseHero,
    filters: undefined,
    results: [],
    trust: clinicTrust,
    emptyState: (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No results yet. Adjust filters or connect the search API.
      </div>
    ),
  },
  render: (args) => <FilterHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/no results yet/i)).toBeInTheDocument()
  },
}

export const NoHeroMedia: Story = {
  args: {
    hero: {
      ...baseHero,
      subtitle: 'Same layout, no hero media provided',
      features: ['Edge case coverage', 'No asset dependency'],
    },
    filters: undefined,
    results: sampleResults,
    trust: clinicTrust,
  },
  render: (args) => <FilterHarness {...args} />,
}

export const LongResultsList: Story = {
  args: {
    hero: {
      ...baseHero,
      subtitle: 'Stress test: long results list',
      features: ['Scroll behavior', 'Card spacing'],
      media: {
        src: medicalHero,
        alt: 'Bright hospital waiting area',
      },
    },
    filters: undefined,
    results: makeClinicList(18),
    trust: clinicTrust,
  },
  render: (args) => <FilterHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/#18$/)).toBeInTheDocument()
  },
}

export const NoFiltersPanel: Story = {
  args: {
    hero: {
      ...baseHero,
      subtitle: 'Edge case: no filters panel provided',
      features: ['Template resilience'],
    },
    filters: null,
    results: sampleResults,
    trust: clinicTrust,
  },
}

export const FilterByHighRating: Story = {
  args: {
    hero: {
      ...baseHero,
      media: {
        src: medicalHero,
        alt: 'Bright hospital waiting area',
      },
    },
    filters: undefined,
    results: sampleResults,
    trust: clinicTrust,
  },
  render: (args) => <FilterHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: '4.5+ ★' }))

    await waitFor(() => expect(canvas.queryByText('Ring Clinic')).not.toBeInTheDocument())

    expect(canvas.getByText('Munich Medical Center')).toBeInTheDocument()
  },
}

export const FilterByShortWaitTime: Story = {
  args: {
    hero: baseHero,
    filters: undefined,
    results: sampleResults,
    trust: clinicTrust,
  },
  render: (args) => <FilterHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Up to 2 weeks' }))

    await waitFor(() => {
      expect(canvas.queryByText('Dortmund Care Hospital')).not.toBeInTheDocument()
      expect(canvas.getByText('Hamburg Coastal Clinic')).toBeInTheDocument()
    })
  },
}

export const FilterByTreatmentHipReplacement: Story = {
  args: {
    hero: baseHero,
    filters: undefined,
    results: sampleResults,
    trust: clinicTrust,
  },
  render: (args) => <FilterHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Hip replacement' }))

    await waitFor(() => {
      expect(canvas.queryByText('Munich Medical Center')).not.toBeInTheDocument()
      expect(canvas.getByText('Hamburg Coastal Clinic')).toBeInTheDocument()
    })
  },
}
