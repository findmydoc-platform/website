import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import * as React from 'react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingFilters } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { sortListingComparison, SORT_OPTIONS, type SortOption } from '@/utilities/listingComparison/sort'
import { SortControl } from '@/components/molecules/SortControl'
import { withViewportStory } from '../utils/viewportMatrix'
import {
  applyListingComparisonLocalFilters,
  type ListingComparisonFilterState,
} from '@/stories/templates/helpers/listingComparisonLocalFilters'
import { storyClinicImages } from '@/stories/fixtures/assets'

import { clinicFilterOptions, clinicResults, clinicTrust, makeClinicList } from '@/stories/fixtures/listings'

const meta = {
  title: 'Domain/Listing/Templates/ListingComparison',
  component: ListingComparison,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:listing', 'layer:template', 'status:stable', 'used-in:route:/listing-comparison'],
} satisfies Meta<typeof ListingComparison>

export default meta
type Story = StoryObj<typeof meta>

const baseHero = {
  title: 'Compare clinic prices',
  subtitle: 'Transparent pricing for medical treatments near you',
  features: ['Structured clinic profiles', 'Listed price fields', 'Direct clinic contact'],
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

const storySortOptions = SORT_OPTIONS.filter((option) => option.value !== 'rating-desc')

function StoryListingFilters({
  onChange,
  priceBounds,
}: {
  onChange: (filters: FilterState) => void
  priceBounds: { min: number; max: number }
}) {
  const [cities, setCities] = React.useState<string[]>([])
  const [waitTimes, setWaitTimes] = React.useState<string[]>([])
  const [treatments, setTreatments] = React.useState<string[]>([])
  const [priceRange, setPriceRange] = React.useState<[number, number]>([priceBounds.min, priceBounds.max])

  const selectedWaitTimeRanges = React.useMemo(
    () =>
      waitTimes.flatMap((label) => {
        const option = clinicFilterOptions.waitTimes.find((entry) => entry.label === label)
        return option ? [{ minWeeks: option.minWeeks, maxWeeks: option.maxWeeks }] : []
      }),
    [waitTimes],
  )

  React.useEffect(() => {
    onChange({
      cities,
      specialty: null,
      waitTimes: selectedWaitTimeRanges,
      treatments,
      priceRange,
      rating: null,
    })
  }, [cities, onChange, priceRange, selectedWaitTimeRanges, treatments])

  return (
    <ListingFilters.Root
      priceBounds={priceBounds}
      defaultPriceRange={[priceBounds.min, priceBounds.max]}
      onPriceChange={setPriceRange}
    >
      <ListingFilters.Price />
      <ListingFilters.CheckboxGroup
        label="City"
        options={clinicFilterOptions.cities}
        value={cities}
        onValueChange={setCities}
      />
      <ListingFilters.CheckboxGroup
        label="Wait time"
        options={clinicFilterOptions.waitTimes.map((option) => option.label)}
        value={waitTimes}
        onValueChange={setWaitTimes}
      />
      <ListingFilters.CheckboxGroup
        label="Treatment"
        options={clinicFilterOptions.treatments}
        value={treatments}
        onValueChange={setTreatments}
      />
    </ListingFilters.Root>
  )
}

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
      filters={<StoryListingFilters priceBounds={{ min: 0, max: maxPrice }} onChange={setFilters} />}
      results={sortedResults}
      totalResultsCount={sortedResults.length}
      sortControl={<SortControl value={sortBy} onValueChange={setSortBy} options={storySortOptions} />}
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
        src: storyClinicImages.listing.exterior,
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
        src: storyClinicImages.listing.exterior,
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

    await userEvent.click(canvas.getByRole('button', { name: /^Wait time/ }))
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

    await userEvent.click(canvas.getByRole('button', { name: /^Treatment/ }))
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
        src: storyClinicImages.listing.exterior,
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

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')
