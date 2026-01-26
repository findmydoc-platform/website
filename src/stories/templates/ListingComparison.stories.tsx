import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import * as React from 'react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { ListingComparisonFilters } from '@/app/(frontend)/listing-comparison/ListingComparisonFilters.client'
import { applyListingComparisonFilters, type ListingComparisonFilterState } from '@/utilities/listingComparison/filters'

import { clinicFilterOptions, clinicResults, clinicTrust, makeClinicList } from '@/stories/fixtures/listings'

import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'

const meta = {
  title: 'Templates/ListingComparison',
  component: ListingComparison,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ListingComparison>

export default meta
type Story = StoryObj<typeof meta>

const baseHero = {
  title: 'Compare clinic prices',
  subtitle: 'Transparent pricing for medical treatments near you',
  features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
  bulletStyle: 'circle' as const,
}

type FilterState = {
  cities: ListingComparisonFilterState['cities']
  waitTimes: ListingComparisonFilterState['waitTimes']
  treatments: ListingComparisonFilterState['treatments']
  priceRange: ListingComparisonFilterState['priceRange']
  rating: ListingComparisonFilterState['rating']
}

type TemplateArgs = React.ComponentProps<typeof ListingComparison>

const FilterHarness: React.FC<TemplateArgs> = ({ hero, trust, results = [], emptyState }) => {
  const [filters, setFilters] = React.useState<FilterState>({
    cities: [],
    waitTimes: [],
    treatments: [],
    priceRange: [0, 20000],
    rating: null,
  })

  const filteredResults = React.useMemo(() => applyListingComparisonFilters(results, filters), [filters, results])

  return (
    <ListingComparison
      hero={hero}
      filters={
        <ListingComparisonFilters
          cityOptions={clinicFilterOptions.cities}
          waitTimeOptions={clinicFilterOptions.waitTimes}
          treatmentOptions={clinicFilterOptions.treatments}
          onChange={setFilters}
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
        src: clinicHospitalExterior,
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
        src: clinicHospitalExterior,
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
        src: clinicHospitalExterior,
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
