import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import * as React from 'react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { ListingComparisonFilters } from '@/app/(frontend)/listing-comparison/ListingComparisonFilters.client'
import { sortListingComparison, SORT_OPTIONS, type SortOption } from '@/utilities/listingComparison/sort'
import { SortControl } from '@/components/molecules/SortControl'
import {
  applyListingComparisonLocalFilters,
  type ListingComparisonFilterState,
} from '@/stories/templates/helpers/listingComparisonLocalFilters'

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
  specialty: ListingComparisonFilterState['specialty']
  waitTimes: ListingComparisonFilterState['waitTimes']
  treatments: ListingComparisonFilterState['treatments']
  priceRange: ListingComparisonFilterState['priceRange']
  rating: ListingComparisonFilterState['rating']
}

type TemplateArgs = React.ComponentProps<typeof ListingComparison>

const storySpecialtyOptions = [
  { value: 'orthopedics', label: 'Orthopedics', depth: 0, parentValue: null },
  { value: 'ophthalmology', label: 'Ophthalmology', depth: 0, parentValue: null },
  { value: 'dental', label: 'Dental', depth: 0, parentValue: null },
] as const

const storyTreatmentGroups = [
  {
    specialty: storySpecialtyOptions[0],
    options: ['Hip replacement', 'Knee replacement'].map((label) => ({ value: label, label, plainLabel: label })),
  },
  {
    specialty: storySpecialtyOptions[1],
    options: ['Cataract surgery', 'LASIK eye surgery'].map((label) => ({ value: label, label, plainLabel: label })),
  },
  {
    specialty: storySpecialtyOptions[2],
    options: ['Dental implant'].map((label) => ({ value: label, label, plainLabel: label })),
  },
]

const FilterHarness: React.FC<TemplateArgs> = ({ hero, trust, results = [], emptyState }) => {
  const maxPrice = React.useMemo(() => {
    return results.reduce((currentMax, clinic) => {
      const price = clinic.priceFrom?.value
      if (typeof price !== 'number' || !Number.isFinite(price)) return currentMax
      return Math.max(currentMax, price)
    }, 0)
  }, [results])

  const [filters, setFilters] = React.useState<FilterState>({
    cities: [],
    specialty: null,
    waitTimes: [],
    treatments: [],
    priceRange: [0, maxPrice],
    rating: null,
  })
  const [sortBy, setSortBy] = React.useState<SortOption>('rank')

  React.useEffect(() => {
    setFilters((current) => {
      const upper = Math.max(Math.min(current.priceRange[1], maxPrice), 0)
      const lower = Math.min(Math.max(current.priceRange[0], 0), upper)

      if (current.priceRange[0] === lower && current.priceRange[1] === upper) {
        return current
      }

      return {
        ...current,
        priceRange: [lower, upper],
      }
    })
  }, [maxPrice])

  const filteredResults = React.useMemo(() => applyListingComparisonLocalFilters(results, filters), [filters, results])
  const sortedResults = React.useMemo(() => sortListingComparison(filteredResults, sortBy), [filteredResults, sortBy])

  return (
    <ListingComparison
      hero={hero}
      filters={
        <ListingComparisonFilters
          cityOptions={clinicFilterOptions.cities}
          specialtyOptions={storySpecialtyOptions.map((option) => ({ ...option }))}
          waitTimeOptions={clinicFilterOptions.waitTimes}
          treatmentGroups={storyTreatmentGroups.map((group) => ({
            ...group,
            specialty: { ...group.specialty },
            options: group.options.map((option) => ({ ...option })),
          }))}
          priceBounds={{ min: 0, max: maxPrice }}
          onChange={setFilters}
        />
      }
      results={sortedResults}
      totalResultsCount={sortedResults.length}
      sortControl={<SortControl value={sortBy} onValueChange={setSortBy} options={SORT_OPTIONS} />}
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
    await userEvent.click(canvas.getByRole('button', { name: /City/i }))
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

    await userEvent.click(canvas.getByRole('button', { name: /Wait time/i }))
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

    await userEvent.click(canvas.getByRole('button', { name: /Treatment/i }))
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Hip replacement' }))

    await waitFor(() => {
      expect(canvas.queryByText('Munich Medical Center')).not.toBeInTheDocument()
      expect(canvas.getByText('Hamburg Coastal Clinic')).toBeInTheDocument()
    })
  },
}

export const SortByPrice: Story = {
  args: {
    hero: {
      ...baseHero,
      subtitle: 'Sort clinics by price (low to high)',
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
    const doc = within(canvasElement.ownerDocument.body)

    const expectedFirst = sortListingComparison(sampleResults, 'price-asc')[0]?.name
    expect(expectedFirst).toBeTruthy()

    // Check that results summary is displayed
    expect(canvas.getByText(/showing/i)).toBeInTheDocument()

    // Find and click the sort control
    const sortTrigger = canvas.getByRole('combobox', { name: /sort/i })
    await userEvent.click(sortTrigger)

    // Select "Price: Low to High"
    const priceOption = await doc.findByRole('option', { name: /price: low to high/i })
    await userEvent.click(priceOption)

    await waitFor(() => {
      // Verify the first clinic has changed (sorted by price)
      const articles = canvas.getAllByRole('article')
      expect(articles[0]).toHaveTextContent(new RegExp(expectedFirst as string, 'i'))
    })
  },
}

export const SortByRating: Story = {
  args: {
    hero: {
      ...baseHero,
      subtitle: 'Sort clinics by highest rating',
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
    const doc = within(canvasElement.ownerDocument.body)

    const expectedFirst = sortListingComparison(sampleResults, 'rating-desc')[0]?.name
    expect(expectedFirst).toBeTruthy()

    // Find and click the sort control
    const sortTrigger = canvas.getByRole('combobox', { name: /sort/i })
    await userEvent.click(sortTrigger)

    // Select "Highest rated"
    const ratingOption = await doc.findByRole('option', { name: /highest rated/i })
    await userEvent.click(ratingOption)

    await waitFor(() => {
      // Verify sorting by rating worked
      const articles = canvas.getAllByRole('article')
      expect(articles[0]).toHaveTextContent(new RegExp(expectedFirst as string, 'i'))
    })
  },
}
