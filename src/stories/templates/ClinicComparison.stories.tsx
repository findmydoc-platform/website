import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { within, userEvent, waitFor } from '@storybook/testing-library'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'
import * as React from 'react'

import type { ClinicResultCardData } from '@/components/organisms/ClinicResultCard'
import { ClinicComparison } from '@/components/templates/ClinicComparison/Component'
import { ClinicComparisonFilters } from '@/app/(frontend)/clinic-filters/ClinicComparisonFilters.client'

import clinicConsultation from '@/stories/assets/clinic-consultation.jpg'
import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'
import clinicInterior from '@/stories/assets/content-clinic-interior.jpg'
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

const options = {
  cities: ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund'],
  waitTimes: [
    { label: 'Up to 1 week', minWeeks: 0, maxWeeks: 1 },
    { label: 'Up to 2 weeks', minWeeks: 0, maxWeeks: 2 },
    { label: 'Up to 4 weeks', minWeeks: 0, maxWeeks: 4 },
    { label: 'Over 4 weeks', minWeeks: 4, maxWeeks: undefined },
  ],
  treatments: ['Hip replacement', 'Knee replacement', 'Cataract surgery', 'Dental implant', 'LASIK eye surgery'],
}

type FilterState = {
  cities: string[]
  waitTimes: Array<{ minWeeks: number; maxWeeks?: number }>
  treatments: string[]
  priceRange: [number, number]
  rating: number | null
}

const applyFilters = (list: ClinicResultCardData[], filters: FilterState) => {
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
          cityOptions={options.cities}
          waitTimeOptions={options.waitTimes}
          treatmentOptions={options.treatments}
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

const baseTrust = {
  title: 'Trust proven quality',
  subtitle: 'We only work with certified clinics and guarantee transparent, up-to-date\npricing information',
  stats: [
    { value: '500+', label: 'Verified clinics', Icon: Users },
    { value: '1,200+', label: 'Treatment types', Icon: BadgeCheck },
    { value: '98%', label: 'Satisfaction rate', Icon: Award },
    { value: 'TÜV', label: 'Verified platform', Icon: Shield },
  ],
  badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
}

const sampleResults: ClinicResultCardData[] = [
  {
    rank: 1,
    name: 'Ring Clinic',
    location: 'Cologne, City Center',
    media: { src: clinicHospitalExterior.src, alt: 'Modern clinic exterior', priority: true },
    verification: { variant: 'unverified' },
    rating: { value: 4.4, count: 156 },
    waitTime: '4-5 weeks',
    tags: ['Affordable pricing', 'Great facilities', 'Central location'],
    priceFrom: { label: 'From', value: 7200, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 2,
    name: 'Munich Medical Center',
    location: 'Munich, Schwabing',
    media: { src: medicalHero.src, alt: 'Hospital corridor' },
    verification: { variant: 'gold' },
    rating: { value: 4.6, count: 189 },
    waitTime: '3-4 weeks',
    tags: ['Specialized orthopedics', 'Short waits', 'On-site physiotherapy'],
    priceFrom: { label: 'From', value: 7800, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 3,
    name: 'Stuttgart Surgical Clinic',
    location: 'Stuttgart, Bad Cannstatt',
    media: { src: clinicInterior.src, alt: 'Bright clinic interior' },
    verification: { variant: 'gold' },
    rating: { value: 4.5, count: 178 },
    waitTime: '3-4 weeks',
    tags: ['Experienced team', 'Modern rehab', 'Personalized care'],
    priceFrom: { label: 'From', value: 8100, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 4,
    name: 'Berlin University Hospital',
    location: 'Berlin, Mitte',
    media: { src: clinicConsultation.src, alt: 'Doctor consulting with a patient' },
    verification: { variant: 'gold' },
    rating: { value: 4.8, count: 245 },
    waitTime: '2-3 weeks',
    tags: ['Modern operating rooms', 'Specialist physicians', 'Aftercare included'],
    priceFrom: { label: 'From', value: 8500, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 5,
    name: 'Hamburg Coastal Clinic',
    location: 'Hamburg, Altona',
    media: { src: clinicInterior.src, alt: 'Coastal clinic lobby with seating' },
    verification: { variant: 'silver' },
    rating: { value: 3.1, count: 132 },
    waitTime: '1-2 weeks',
    tags: ['Hip replacement', 'Harbor views', 'Rehab suites'],
    priceFrom: { label: 'From', value: 2500, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 6,
    name: 'Frankfurt Heart Institute',
    location: 'Frankfurt, Westend',
    media: { src: medicalHero.src, alt: 'Cardiology team walking hallway' },
    verification: { variant: 'gold' },
    rating: { value: 4.9, count: 312 },
    waitTime: '2-3 weeks',
    tags: ['Cardiology', 'Cath lab', 'Intensive aftercare'],
    priceFrom: { label: 'From', value: 15000, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 7,
    name: 'Stuttgart Spine Center',
    location: 'Stuttgart, Vaihingen',
    media: { src: clinicHospitalExterior.src, alt: 'Surgical center exterior with glass facade' },
    verification: { variant: 'bronze' },
    rating: { value: 2.8, count: 98 },
    waitTime: '3-4 weeks',
    tags: ['Spine surgery', 'Robotic assistance', 'Rehabilitation'],
    priceFrom: { label: 'From', value: 4300, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 8,
    name: 'Munich Orthopedic Group',
    location: 'Munich, Bogenhausen',
    media: { src: clinicConsultation.src, alt: 'Doctor consulting orthopedic patient' },
    verification: { variant: 'silver' },
    rating: { value: 4.7, count: 204 },
    waitTime: '2-3 weeks',
    tags: ['Knee replacement', 'Sports rehab', 'Private rooms'],
    priceFrom: { label: 'From', value: 9100, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 9,
    name: 'Dortmund Care Hospital',
    location: 'Dortmund, Innenstadt-West',
    media: { src: clinicInterior.src, alt: 'Warm waiting room with natural light' },
    verification: { variant: 'unverified' },
    rating: { value: 2.2, count: 121 },
    waitTime: '4-6 weeks',
    tags: ['General surgery', 'Hip replacement', 'Family suites'],
    priceFrom: { label: 'From', value: 1200, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 10,
    name: 'Düsseldorf Surgical Pavilion',
    location: 'Düsseldorf, Oberkassel',
    media: { src: clinicHospitalExterior.src, alt: 'Surgical pavilion exterior with trees' },
    verification: { variant: 'gold' },
    rating: { value: 4.5, count: 174 },
    waitTime: '1-3 weeks',
    tags: ['Minimally invasive', 'Cataract surgery', 'Recovery lounges'],
    priceFrom: { label: 'From', value: 19500, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 11,
    name: 'Cologne Riverfront Clinic',
    location: 'Cologne, Deutz',
    media: { src: clinicConsultation.src, alt: 'Consultation room with river views' },
    verification: { variant: 'silver' },
    rating: { value: 3.7, count: 143 },
    waitTime: '2-3 weeks',
    tags: ['Dental implant', 'Scenic setting', 'Patient concierge'],
    priceFrom: { label: 'From', value: 5700, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 12,
    name: 'Berlin Eastside Medical',
    location: 'Berlin, Friedrichshain',
    media: { src: medicalHero.src, alt: 'Modern corridor with staff' },
    verification: { variant: 'bronze' },
    rating: { value: 3.9, count: 167 },
    waitTime: '1-2 weeks',
    tags: ['LASIK eye surgery', 'Digital records', 'Evening clinics'],
    priceFrom: { label: 'From', value: 6600, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 13,
    name: 'Hamburg Vision Center',
    location: 'Hamburg, HafenCity',
    media: { src: clinicInterior.src, alt: 'Bright vision center lobby' },
    verification: { variant: 'gold' },
    rating: { value: 4.7, count: 201 },
    waitTime: '1-2 weeks',
    tags: ['LASIK eye surgery', 'Cataract surgery', 'Harbor shuttle'],
    priceFrom: { label: 'From', value: 8300, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 14,
    name: 'Frankfurt Joint Clinic',
    location: 'Frankfurt, Sachsenhausen',
    media: { src: clinicHospitalExterior.src, alt: 'Clinic with large glass entrance' },
    verification: { variant: 'silver' },
    rating: { value: 4.4, count: 154 },
    waitTime: '2-3 weeks',
    tags: ['Knee replacement', 'Hip replacement', 'On-site rehab gym'],
    priceFrom: { label: 'From', value: 10200, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 15,
    name: 'Stuttgart Rehabilitation Hospital',
    location: 'Stuttgart, Möhringen',
    media: { src: clinicConsultation.src, alt: 'Therapy session in rehab hospital' },
    verification: { variant: 'unverified' },
    rating: { value: 1.9, count: 109 },
    waitTime: '3-5 weeks',
    tags: ['Rehabilitation', 'Hydrotherapy', 'Family programs'],
    priceFrom: { label: 'From', value: 3200, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 16,
    name: 'Munich Cardio Clinic',
    location: 'Munich, Sendling',
    media: { src: medicalHero.src, alt: 'Cardiac ward corridor' },
    verification: { variant: 'gold' },
    rating: { value: 5.0, count: 402 },
    waitTime: '1-2 weeks',
    tags: ['Cardiology', 'Hybrid OR', 'Aftercare coaching'],
    priceFrom: { label: 'From', value: 17600, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 17,
    name: 'Dortmund Sports Medicine Center',
    location: 'Dortmund, Hörde',
    media: { src: clinicInterior.src, alt: 'Sports rehab center interior' },
    verification: { variant: 'bronze' },
    rating: { value: 4.3, count: 141 },
    waitTime: '2-3 weeks',
    tags: ['Sports medicine', 'ACL repair', 'Strength lab'],
    priceFrom: { label: 'From', value: 7500, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 18,
    name: 'Düsseldorf Oncology Institute',
    location: 'Düsseldorf, Derendorf',
    media: { src: clinicHospitalExterior.src, alt: 'Oncology institute exterior with greenery' },
    verification: { variant: 'gold' },
    rating: { value: 4.1, count: 198 },
    waitTime: '4-6 weeks',
    tags: ['Oncology', 'Radiation therapy', 'Support programs'],
    priceFrom: { label: 'From', value: 18200, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 19,
    name: 'Cologne Pediatric Hospital',
    location: 'Cologne, Ehrenfeld',
    media: { src: clinicConsultation.src, alt: 'Pediatric ward consult room' },
    verification: { variant: 'silver' },
    rating: { value: 2.5, count: 173 },
    waitTime: '2-3 weeks',
    tags: ['Pediatrics', 'Family housing', 'Child life services'],
    priceFrom: { label: 'From', value: 1400, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    rank: 20,
    name: 'Berlin Prenzlauer Clinic',
    location: 'Berlin, Prenzlauer Berg',
    media: { src: clinicInterior.src, alt: 'Clinic lounge with seating' },
    verification: { variant: 'gold' },
    rating: { value: 4.7, count: 222 },
    waitTime: '1-2 weeks',
    tags: ['Dental implant', 'Hip replacement', 'Neighborhood care'],
    priceFrom: { label: 'From', value: 8700, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
]

export const Default: Story = {
  args: {
    hero: {
      title: 'Compare clinic prices',
      subtitle: 'Transparent pricing for medical treatments near you',
      features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
      bulletStyle: 'circle',
      media: {
        src: medicalHero,
        alt: 'Bright hospital waiting area',
      },
    },
    filters: undefined,
    results: sampleResults,
    trust: baseTrust,
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
    hero: {
      title: 'Compare clinic prices',
      subtitle: 'Transparent pricing for medical treatments near you',
      features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
      bulletStyle: 'circle',
    },
    filters: undefined,
    results: [],
    trust: baseTrust,
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
      title: 'Compare clinic prices',
      subtitle: 'Same layout, no hero media provided',
      features: ['Edge case coverage', 'No asset dependency'],
      bulletStyle: 'circle',
    },
    filters: undefined,
    results: sampleResults,
    trust: baseTrust,
  },
  render: (args) => <FilterHarness {...args} />,
}

export const LongResultsList: Story = {
  args: {
    hero: {
      title: 'Compare clinic prices',
      subtitle: 'Stress test: long results list',
      features: ['Scroll behavior', 'Card spacing'],
      bulletStyle: 'circle',
      media: {
        src: medicalHero,
        alt: 'Bright hospital waiting area',
      },
    },
    filters: undefined,
    results: Array.from({ length: 18 }).map((_, idx) => {
      const base = sampleResults[idx % sampleResults.length]!
      return {
        ...base,
        rank: idx + 1,
        name: `${base.name} #${idx + 1}`,
      }
    }),
    trust: baseTrust,
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
      title: 'Compare clinic prices',
      subtitle: 'Edge case: no filters panel provided',
      features: ['Template resilience'],
      bulletStyle: 'circle',
    },
    filters: null,
    results: sampleResults,
    trust: baseTrust,
  },
}
