import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Label } from '@/components/atoms/label'
import { CheckboxWithLabel } from '@/components/molecules/CheckboxWithLabel'
import { ListingFilters, type ListingCardData, type ListingWaitTime } from '@/components/organisms/Listing'
import { Breadcrumb } from '@/components/molecules/Breadcrumb'
import { SortControl } from '@/components/molecules/SortControl'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { clampPriceRange } from '@/utilities/listingComparison/priceRange'
import { SORT_OPTIONS, sortListingComparison, type SortOption } from '@/utilities/listingComparison/sort'
import { cn } from '@/utilities/ui'

type SpecialtyParent = {
  value: string
  label: string
  description: string
}

type SpecialtyChild = {
  value: string
  label: string
  description: string
  parentValue: string
}

type TreatmentOption = {
  value: string
  label: string
  childValue: string
}

type InternetConceptVariant = 'two-step' | 'applied-tags' | 'dropdown-toolbar' | 'dropdown-toolbar-unified'

type InternetFilterState = {
  cities: string[]
  waitTimes: string[]
  treatments: string[]
  specialtyParent: string | null
  specialtyChild: string | null
  priceRange: [number, number]
  rating: number | null
}

type JourneyPresetId = 'overview' | 'landing-parent' | 'landing-child' | 'landing-treatment'

type JourneyPreset = {
  id: JourneyPresetId
  label: string
  href: string
  specialtyParent: string | null
  specialtyChild: string | null
  treatments: string[]
}

type ClinicFacetAssignment = {
  specialtyParents: string[]
  specialtyChildren: string[]
  treatments: string[]
}

type SharedControlsProps = {
  filters: InternetFilterState
  setFilters: React.Dispatch<React.SetStateAction<InternetFilterState>>
}

type TreatmentGroupForView = {
  child: SpecialtyChild
  treatments: TreatmentOption[]
}

const SPECIALTY_PARENTS: SpecialtyParent[] = [
  {
    value: 'cosmetic-surgery',
    label: 'Cosmetic Surgery',
    description: 'Surgical and minimally invasive shaping procedures.',
  },
  {
    value: 'dental',
    label: 'Dental',
    description: 'Restorative and aesthetic dentistry pathways.',
  },
  {
    value: 'eyes',
    label: 'Eyes',
    description: 'Vision correction and eye surgery options.',
  },
  {
    value: 'hair',
    label: 'Hair',
    description: 'Regeneration and transplant-focused pathways.',
  },
  {
    value: 'skin',
    label: 'Skin',
    description: 'Injectables and resurfacing specialties.',
  },
]

const SPECIALTY_CHILDREN: SpecialtyChild[] = [
  {
    value: 'facial-surgery',
    label: 'Facial Surgery',
    description: 'Face-focused cosmetic surgery subspecialty.',
    parentValue: 'cosmetic-surgery',
  },
  {
    value: 'body-contouring',
    label: 'Body Contouring',
    description: 'Body shaping and contouring surgery subspecialty.',
    parentValue: 'cosmetic-surgery',
  },
  {
    value: 'implants',
    label: 'Implants',
    description: 'Tooth-replacement subspecialty.',
    parentValue: 'dental',
  },
  {
    value: 'orthodontics',
    label: 'Orthodontics',
    description: 'Bite and alignment subspecialty.',
    parentValue: 'dental',
  },
  {
    value: 'general-dentistry',
    label: 'General Dentistry',
    description: 'Routine and restorative dentistry subspecialty.',
    parentValue: 'dental',
  },
  {
    value: 'laser-vision-correction',
    label: 'Laser Vision Correction',
    description: 'Corneal refractive correction subspecialty.',
    parentValue: 'eyes',
  },
  {
    value: 'cataract-surgery',
    label: 'Cataract Surgery',
    description: 'Lens replacement and cataract-focused subspecialty.',
    parentValue: 'eyes',
  },
  {
    value: 'hair-regeneration',
    label: 'Hair Regeneration',
    description: 'Non-surgical hair density and scalp protocols.',
    parentValue: 'hair',
  },
  {
    value: 'hair-transplant-techniques',
    label: 'Hair Transplant Techniques',
    description: 'Surgical graft extraction and implantation methods.',
    parentValue: 'hair',
  },
  {
    value: 'injectable-aesthetics',
    label: 'Injectable Aesthetics',
    description: 'Neuromodulators and filler-focused subspecialty.',
    parentValue: 'skin',
  },
  {
    value: 'skin-resurfacing',
    label: 'Skin Resurfacing',
    description: 'Energy-based and needling resurfacing subspecialty.',
    parentValue: 'skin',
  },
]

const TREATMENT_OPTIONS: TreatmentOption[] = [
  { value: 'rhinoplasty', label: 'Rhinoplasty', childValue: 'facial-surgery' },
  { value: 'blepharoplasty', label: 'Blepharoplasty', childValue: 'facial-surgery' },
  { value: 'liposuction', label: 'Liposuction', childValue: 'body-contouring' },
  { value: 'tummy-tuck', label: 'Tummy Tuck', childValue: 'body-contouring' },
  { value: 'all-on-4-dental-implants', label: 'All-on-4 Dental Implants', childValue: 'implants' },
  { value: 'sinus-lift-surgery', label: 'Sinus Lift Surgery', childValue: 'implants' },
  { value: 'clear-aligner-therapy', label: 'Clear Aligner Therapy', childValue: 'orthodontics' },
  { value: 'ceramic-braces', label: 'Ceramic Braces', childValue: 'orthodontics' },
  { value: 'tooth-extraction', label: 'Tooth Extraction', childValue: 'general-dentistry' },
  { value: 'root-canal-therapy', label: 'Root Canal Therapy', childValue: 'general-dentistry' },
  { value: 'lasik', label: 'LASIK', childValue: 'laser-vision-correction' },
  { value: 'prk', label: 'PRK', childValue: 'laser-vision-correction' },
  { value: 'lens-replacement', label: 'Lens Replacement', childValue: 'cataract-surgery' },
  { value: 'femtosecond-cataract', label: 'Femtosecond Cataract', childValue: 'cataract-surgery' },
  { value: 'prp-hair-therapy', label: 'PRP Hair Therapy', childValue: 'hair-regeneration' },
  { value: 'mesotherapy-hair', label: 'Hair Mesotherapy', childValue: 'hair-regeneration' },
  { value: 'fue-hair-transplant', label: 'FUE Hair Transplant', childValue: 'hair-transplant-techniques' },
  { value: 'dhi-hair-transplant', label: 'DHI Hair Transplant', childValue: 'hair-transplant-techniques' },
  { value: 'botox', label: 'Botox', childValue: 'injectable-aesthetics' },
  { value: 'dermal-fillers', label: 'Dermal Fillers', childValue: 'injectable-aesthetics' },
  { value: 'laser-skin-resurfacing', label: 'Laser Skin Resurfacing', childValue: 'skin-resurfacing' },
  { value: 'microneedling', label: 'Microneedling', childValue: 'skin-resurfacing' },
]

const CONCEPT_VARIANT_LABELS: Record<InternetConceptVariant, string> = {
  'two-step': 'Concept 1: Two-Step Selector (Parent -> Child -> Treatment)',
  'applied-tags': 'Concept 2: Applied Filter Tags with explicit hierarchy',
  'dropdown-toolbar': 'Concept 3: Dropdown Toolbar with 3-level taxonomy',
  'dropdown-toolbar-unified': 'Concept 4: Unified Collapsible Filters (checkbox-first)',
}

const SPECIALTY_PARENT_LABEL_BY_VALUE = new Map(SPECIALTY_PARENTS.map((item) => [item.value, item.label]))
const SPECIALTY_CHILD_LABEL_BY_VALUE = new Map(SPECIALTY_CHILDREN.map((item) => [item.value, item.label]))
const SPECIALTY_PARENT_BY_CHILD = new Map(SPECIALTY_CHILDREN.map((item) => [item.value, item.parentValue]))
const TREATMENT_CHILD_BY_VALUE = new Map(TREATMENT_OPTIONS.map((item) => [item.value, item.childValue]))
const TREATMENT_LABEL_BY_VALUE = new Map(TREATMENT_OPTIONS.map((item) => [item.value, item.label]))

const CHILDREN_BY_PARENT = new Map<string, SpecialtyChild[]>()
SPECIALTY_CHILDREN.forEach((child) => {
  const siblings = CHILDREN_BY_PARENT.get(child.parentValue) ?? []
  siblings.push(child)
  CHILDREN_BY_PARENT.set(child.parentValue, siblings)
})

const TREATMENTS_BY_CHILD = new Map<string, TreatmentOption[]>()
TREATMENT_OPTIONS.forEach((treatment) => {
  const siblings = TREATMENTS_BY_CHILD.get(treatment.childValue) ?? []
  siblings.push(treatment)
  TREATMENTS_BY_CHILD.set(treatment.childValue, siblings)
})

const TREATMENT_ASSIGNMENTS = TREATMENT_OPTIONS.map((treatment) => {
  const parentValue = SPECIALTY_PARENT_BY_CHILD.get(treatment.childValue)
  if (!parentValue) {
    throw new Error(`Missing parent specialty for child specialty: ${treatment.childValue}`)
  }

  return {
    treatmentValue: treatment.value,
    treatmentLabel: treatment.label,
    childValue: treatment.childValue,
    childLabel: SPECIALTY_CHILD_LABEL_BY_VALUE.get(treatment.childValue) ?? treatment.childValue,
    parentValue,
    parentLabel: SPECIALTY_PARENT_LABEL_BY_VALUE.get(parentValue) ?? parentValue,
  }
})

const JOURNEY_PRESETS: JourneyPreset[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/listing-comparison',
    specialtyParent: null,
    specialtyChild: null,
    treatments: [],
  },
  {
    id: 'landing-parent',
    label: 'Landing parent tab',
    href: '/listing-comparison?specialtyParent=hair',
    specialtyParent: 'hair',
    specialtyChild: null,
    treatments: [],
  },
  {
    id: 'landing-child',
    label: 'Landing child card',
    href: '/listing-comparison?specialtyParent=hair&specialtyChild=hair-transplant-techniques',
    specialtyParent: 'hair',
    specialtyChild: 'hair-transplant-techniques',
    treatments: [],
  },
  {
    id: 'landing-treatment',
    label: 'Landing curated treatment',
    href: '/listing-comparison?specialtyParent=hair&specialtyChild=hair-transplant-techniques&treatment=fue-hair-transplant',
    specialtyParent: 'hair',
    specialtyChild: 'hair-transplant-techniques',
    treatments: ['fue-hair-transplant'],
  },
]

const JOURNEY_PRESET_BY_ID = new Map(JOURNEY_PRESETS.map((preset) => [preset.id, preset]))

const CITY_OPTIONS = ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund'].map(
  (city) => ({ label: city, value: city }),
)

const WAIT_TIME_OPTIONS = [
  { label: 'Up to 1 week', minWeeks: 0, maxWeeks: 1 },
  { label: 'Up to 2 weeks', minWeeks: 0, maxWeeks: 2 },
  { label: 'Up to 4 weeks', minWeeks: 0, maxWeeks: 4 },
  { label: 'Over 4 weeks', minWeeks: 4, maxWeeks: undefined },
]

const WAIT_TIME_BY_LABEL = new Map(WAIT_TIME_OPTIONS.map((option) => [option.label, option]))
const WAIT_TIME_CHECKBOX_OPTIONS = WAIT_TIME_OPTIONS.map((option) => ({ label: option.label, value: option.label }))

const TRUST_SECTION_PROPS = {
  title: 'Trust proven quality',
  subtitle: 'We only work with certified clinics and provide transparent, up-to-date pricing information.',
  stats: [
    { value: 500, suffix: '+', label: 'Verified clinics', Icon: Users },
    { value: 1200, suffix: '+', label: 'Treatment types', Icon: BadgeCheck },
    { value: 98, suffix: '%', label: 'Satisfaction rate', Icon: Award },
    { valueText: 'TÜV', label: 'Verified platform', Icon: Shield },
  ],
  badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
}

const CLINIC_FACETS = new Map<ListingCardData['id'], ClinicFacetAssignment>()

const BASE_RESULTS: ListingCardData[] = [
  {
    id: 'clinic-1',
    name: 'Ring Clinic',
    location: 'Cologne, City Center',
    media: { src: '/favicon.svg', alt: 'Clinic building exterior' },
    verification: { variant: 'unverified' },
    rating: { value: 4.4, count: 156 },
    waitTime: { label: '4-5 weeks', minWeeks: 4, maxWeeks: 5 },
    tags: ['Affordable pricing', 'Great facilities'],
    priceFrom: { label: 'From', value: 7200, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    id: 'clinic-2',
    name: 'Munich Medical Center',
    location: 'Munich, Schwabing',
    media: { src: '/favicon.svg', alt: 'Clinic building exterior' },
    verification: { variant: 'gold' },
    rating: { value: 4.6, count: 189 },
    waitTime: { label: '3-4 weeks', minWeeks: 3, maxWeeks: 4 },
    tags: ['Short waits', 'On-site physiotherapy'],
    priceFrom: { label: 'From', value: 7800, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    id: 'clinic-3',
    name: 'Berlin University Hospital',
    location: 'Berlin, Mitte',
    media: { src: '/favicon.svg', alt: 'Clinic building exterior' },
    verification: { variant: 'gold' },
    rating: { value: 4.8, count: 245 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Specialist physicians', 'Aftercare included'],
    priceFrom: { label: 'From', value: 8500, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    id: 'clinic-4',
    name: 'Hamburg Coastal Clinic',
    location: 'Hamburg, Altona',
    media: { src: '/favicon.svg', alt: 'Clinic building exterior' },
    verification: { variant: 'silver' },
    rating: { value: 3.1, count: 132 },
    waitTime: { label: '1-2 weeks', minWeeks: 1, maxWeeks: 2 },
    tags: ['Rehab suites', 'Harbor views'],
    priceFrom: { label: 'From', value: 2500, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    id: 'clinic-5',
    name: 'Frankfurt Heart Institute',
    location: 'Frankfurt, Westend',
    media: { src: '/favicon.svg', alt: 'Clinic building exterior' },
    verification: { variant: 'gold' },
    rating: { value: 4.9, count: 312 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Intensive aftercare', 'High patient trust'],
    priceFrom: { label: 'From', value: 15000, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
  {
    id: 'clinic-6',
    name: 'Düsseldorf Surgical Pavilion',
    location: 'Düsseldorf, Oberkassel',
    media: { src: '/favicon.svg', alt: 'Clinic building exterior' },
    verification: { variant: 'gold' },
    rating: { value: 4.5, count: 174 },
    waitTime: { label: '1-3 weeks', minWeeks: 1, maxWeeks: 3 },
    tags: ['Minimally invasive', 'Recovery lounges'],
    priceFrom: { label: 'From', value: 19500, currency: 'EUR' },
    actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
  },
]

const RESULT_ITEM_COUNT = 36

const RESULTS: ListingCardData[] = Array.from({ length: RESULT_ITEM_COUNT }, (_, index) => {
  const clinic = BASE_RESULTS[index % BASE_RESULTS.length]
  if (!clinic) {
    return {
      id: `fallback-${index}`,
      name: `Fallback Clinic ${index + 1}`,
      location: 'Berlin, Mitte',
      media: { src: '/favicon.svg', alt: 'Clinic building exterior' },
      verification: { variant: 'unverified' },
      rating: { value: 4.0, count: 1 },
      waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
      tags: ['Fallback'],
      priceFrom: { label: 'From', value: 5000, currency: 'EUR' },
      actions: { details: { href: '#', label: 'Details' }, compare: { href: '#', label: 'Compare' } },
    }
  }

  const sequence = Math.floor(index / BASE_RESULTS.length) + 1
  const primary = TREATMENT_ASSIGNMENTS[index % TREATMENT_ASSIGNMENTS.length]
  const secondary = TREATMENT_ASSIGNMENTS[(index + 5) % TREATMENT_ASSIGNMENTS.length]

  const treatmentValues = dedupeValues([primary?.treatmentValue ?? '', secondary?.treatmentValue ?? '']).filter(Boolean)
  const childValues = dedupeValues([primary?.childValue ?? '', secondary?.childValue ?? '']).filter(Boolean)
  const parentValues = dedupeValues([primary?.parentValue ?? '', secondary?.parentValue ?? '']).filter(Boolean)

  const clinicId = `${clinic.id}-${sequence}`

  CLINIC_FACETS.set(clinicId, {
    specialtyParents: parentValues,
    specialtyChildren: childValues,
    treatments: treatmentValues,
  })

  return {
    ...clinic,
    id: clinicId,
    name: `${clinic.name} #${sequence}`,
    priceFrom: clinic.priceFrom
      ? {
          ...clinic.priceFrom,
          value: clinic.priceFrom.value + (sequence - 1) * 90,
        }
      : undefined,
    tags: dedupeValues([
      ...(clinic.tags ?? []),
      ...parentValues.map((value) => SPECIALTY_PARENT_LABEL_BY_VALUE.get(value) ?? value),
      ...childValues.map((value) => SPECIALTY_CHILD_LABEL_BY_VALUE.get(value) ?? value),
      ...treatmentValues.map((value) => TREATMENT_LABEL_BY_VALUE.get(value) ?? value),
    ]),
  }
})

function dedupeValues(values: string[]): string[] {
  return Array.from(new Set(values))
}

function toggleValueInSelection(values: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return dedupeValues([...values, value])
  }

  return values.filter((existing) => existing !== value)
}

function getChildSpecialtiesForParent(parent: string | null): SpecialtyChild[] {
  if (!parent) return SPECIALTY_CHILDREN
  return CHILDREN_BY_PARENT.get(parent) ?? []
}

function getTreatmentGroupsForSelection(parent: string | null, child: string | null): TreatmentGroupForView[] {
  if (child) {
    const selectedChild = SPECIALTY_CHILDREN.find((item) => item.value === child)
    if (!selectedChild) return []
    return [{ child: selectedChild, treatments: TREATMENTS_BY_CHILD.get(child) ?? [] }]
  }

  const visibleChildren = getChildSpecialtiesForParent(parent)
  return visibleChildren
    .map((visibleChild) => ({
      child: visibleChild,
      treatments: TREATMENTS_BY_CHILD.get(visibleChild.value) ?? [],
    }))
    .filter((group) => group.treatments.length > 0)
}

function defaultFilters(maxPrice: number): InternetFilterState {
  return {
    cities: [],
    waitTimes: [],
    treatments: [],
    specialtyParent: null,
    specialtyChild: null,
    priceRange: [0, maxPrice],
    rating: null,
  }
}

function buildFilterStateFromJourneyPreset(preset: JourneyPreset, maxPrice: number): InternetFilterState {
  return {
    ...defaultFilters(maxPrice),
    specialtyParent: preset.specialtyParent,
    specialtyChild: preset.specialtyChild,
    treatments: [...preset.treatments],
  }
}

function buildListingPreviewHref(
  filters: Pick<InternetFilterState, 'specialtyParent' | 'specialtyChild' | 'treatments'>,
): string {
  const params = new URLSearchParams()
  if (filters.specialtyParent) {
    params.set('specialtyParent', filters.specialtyParent)
  }
  if (filters.specialtyChild) {
    params.set('specialtyChild', filters.specialtyChild)
  }
  if (filters.treatments.length > 0) {
    params.set('treatment', filters.treatments.join(','))
  }

  const query = params.toString()
  return query ? `/listing-comparison?${query}` : '/listing-comparison'
}

function buildBreadcrumbItems(filters: Pick<InternetFilterState, 'specialtyParent' | 'specialtyChild' | 'treatments'>) {
  if (!filters.specialtyParent) return []

  const parentLabel = SPECIALTY_PARENT_LABEL_BY_VALUE.get(filters.specialtyParent) ?? filters.specialtyParent
  const parentHref = `/listing-comparison?specialtyParent=${encodeURIComponent(filters.specialtyParent)}`

  const items: Array<{ label: string; href: string }> = [
    { label: 'Home', href: '/' },
    { label: 'Clinics', href: '/listing-comparison' },
    { label: parentLabel, href: parentHref },
  ]

  if (filters.specialtyChild) {
    const childLabel = SPECIALTY_CHILD_LABEL_BY_VALUE.get(filters.specialtyChild) ?? filters.specialtyChild
    const childHref = `${parentHref}&specialtyChild=${encodeURIComponent(filters.specialtyChild)}`
    items.push({ label: childLabel, href: childHref })

    if (filters.treatments.length === 1) {
      const treatmentValue = filters.treatments[0]
      const treatmentLabel = treatmentValue ? (TREATMENT_LABEL_BY_VALUE.get(treatmentValue) ?? treatmentValue) : null
      if (treatmentValue && treatmentLabel) {
        items.push({
          label: treatmentLabel,
          href: `${childHref}&treatment=${encodeURIComponent(treatmentValue)}`,
        })
      }
    }
  }

  return items
}

function selectParentSpecialty(
  setFilters: React.Dispatch<React.SetStateAction<InternetFilterState>>,
  nextParent: string | null,
) {
  setFilters((current) => {
    if (!nextParent) {
      return {
        ...current,
        specialtyParent: null,
        specialtyChild: null,
        treatments: [],
      }
    }

    const childStillValid = current.specialtyChild
      ? SPECIALTY_PARENT_BY_CHILD.get(current.specialtyChild) === nextParent
      : false

    return {
      ...current,
      specialtyParent: nextParent,
      specialtyChild: childStillValid ? current.specialtyChild : null,
      treatments: childStillValid
        ? current.treatments.filter((value) => TREATMENT_CHILD_BY_VALUE.get(value) === current.specialtyChild)
        : [],
    }
  })
}

function selectChildSpecialty(
  setFilters: React.Dispatch<React.SetStateAction<InternetFilterState>>,
  nextChild: string | null,
) {
  setFilters((current) => {
    if (!nextChild) {
      return {
        ...current,
        specialtyChild: null,
        treatments: [],
      }
    }

    const parentValue = SPECIALTY_PARENT_BY_CHILD.get(nextChild) ?? null

    return {
      ...current,
      specialtyParent: parentValue,
      specialtyChild: nextChild,
      treatments: current.treatments.filter((value) => TREATMENT_CHILD_BY_VALUE.get(value) === nextChild),
    }
  })
}

function toggleTreatmentSelection(
  setFilters: React.Dispatch<React.SetStateAction<InternetFilterState>>,
  treatmentValue: string,
) {
  const childValue = TREATMENT_CHILD_BY_VALUE.get(treatmentValue)
  if (!childValue) return

  const parentValue = SPECIALTY_PARENT_BY_CHILD.get(childValue)
  if (!parentValue) return

  setFilters((current) => {
    if (current.specialtyChild !== childValue || current.specialtyParent !== parentValue) {
      return {
        ...current,
        specialtyParent: parentValue,
        specialtyChild: childValue,
        treatments: [treatmentValue],
      }
    }

    const exists = current.treatments.includes(treatmentValue)
    return {
      ...current,
      treatments: exists
        ? current.treatments.filter((value) => value !== treatmentValue)
        : [...current.treatments, treatmentValue],
    }
  })
}

function matchesWaitTime(waitTime: ListingWaitTime, selectedWaitTimes: string[]): boolean {
  if (selectedWaitTimes.length === 0) return true

  const clinicMin = waitTime.minWeeks
  const clinicMax = waitTime.maxWeeks ?? waitTime.minWeeks

  return selectedWaitTimes.some((label) => {
    const range = WAIT_TIME_BY_LABEL.get(label)
    if (!range) return false

    const minOk = clinicMin >= range.minWeeks
    const maxOk = range.maxWeeks === undefined ? clinicMin >= range.minWeeks : clinicMax <= range.maxWeeks
    return minOk && maxOk
  })
}

function applyFilters(list: ListingCardData[], filters: InternetFilterState): ListingCardData[] {
  return list.filter((clinic) => {
    const facets = CLINIC_FACETS.get(clinic.id) ?? {
      specialtyParents: [],
      specialtyChildren: [],
      treatments: [],
    }

    const cityMatch =
      filters.cities.length === 0 ||
      filters.cities.some((city) => clinic.location?.toLowerCase().includes(city.toLowerCase()))

    const waitTimeMatch = (() => {
      if (filters.waitTimes.length === 0) return true
      if (!clinic.waitTime) return false
      return matchesWaitTime(clinic.waitTime, filters.waitTimes)
    })()

    const priceMatch = (() => {
      const price = clinic.priceFrom?.value
      if (typeof price !== 'number' || !Number.isFinite(price)) return true
      return price >= filters.priceRange[0] && price <= filters.priceRange[1]
    })()

    const ratingMatch = (() => {
      if (filters.rating === null) return true
      return (clinic.rating?.value ?? 0) >= filters.rating
    })()

    const parentMatch = filters.specialtyParent === null || facets.specialtyParents.includes(filters.specialtyParent)

    const childMatch = filters.specialtyChild === null || facets.specialtyChildren.includes(filters.specialtyChild)

    const treatmentMatch =
      filters.treatments.length === 0 || filters.treatments.some((treatment) => facets.treatments.includes(treatment))

    return cityMatch && waitTimeMatch && priceMatch && ratingMatch && parentMatch && childMatch && treatmentMatch
  })
}

const ParentSelectorButtons: React.FC<SharedControlsProps> = ({ filters, setFilters }) => {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="xs"
        variant={filters.specialtyParent === null ? 'primary' : 'outline'}
        onClick={() => selectParentSpecialty(setFilters, null)}
      >
        All specialties
      </Button>
      {SPECIALTY_PARENTS.map((parent) => (
        <Button
          key={parent.value}
          size="xs"
          variant={filters.specialtyParent === parent.value ? 'primary' : 'outline'}
          onClick={() => selectParentSpecialty(setFilters, parent.value)}
        >
          {parent.label}
        </Button>
      ))}
    </div>
  )
}

const ChildSelectorButtons: React.FC<SharedControlsProps> = ({ filters, setFilters }) => {
  const visibleChildren = getChildSpecialtiesForParent(filters.specialtyParent)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="xs"
          variant={filters.specialtyChild === null ? 'primary' : 'outline'}
          onClick={() => selectChildSpecialty(setFilters, null)}
        >
          All subspecialties
        </Button>
        {visibleChildren.map((child) => (
          <Button
            key={child.value}
            size="xs"
            variant={filters.specialtyChild === child.value ? 'primary' : 'outline'}
            onClick={() => selectChildSpecialty(setFilters, child.value)}
          >
            {child.label}
          </Button>
        ))}
      </div>

      {visibleChildren.length === 0 ? (
        <p className="text-xs text-muted-foreground">Select a parent specialty to see subspecialties.</p>
      ) : null}
    </div>
  )
}

type TreatmentSelectionListProps = {
  filters: InternetFilterState
  setFilters: React.Dispatch<React.SetStateAction<InternetFilterState>>
  compact?: boolean
}

const TreatmentSelectionList: React.FC<TreatmentSelectionListProps> = ({ filters, setFilters, compact = false }) => {
  const visibleGroups = getTreatmentGroupsForSelection(filters.specialtyParent, filters.specialtyChild)

  if (visibleGroups.length === 0) {
    return <p className="text-xs text-muted-foreground">No treatments available for the current specialty scope.</p>
  }

  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      {visibleGroups.map((group) => (
        <div key={group.child.value} className="space-y-1.5">
          {filters.specialtyChild === null ? (
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {group.child.label}
            </p>
          ) : null}

          <div className="grid gap-1.5">
            {group.treatments.map((treatment) => {
              const selected = filters.treatments.includes(treatment.value)
              return (
                <button
                  key={treatment.value}
                  type="button"
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-left text-xs',
                    selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-muted/40',
                  )}
                  onClick={() => toggleTreatmentSelection(setFilters, treatment.value)}
                >
                  {treatment.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const TwoStepControls: React.FC<SharedControlsProps> = ({ filters, setFilters }) => {
  return (
    <section className="space-y-3">
      <Label className="text-sm font-semibold">Two-Step Selector</Label>
      <div className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Step 1: Specialty</p>
          <ParentSelectorButtons filters={filters} setFilters={setFilters} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Step 2: Subspecialty
          </p>
          <ChildSelectorButtons filters={filters} setFilters={setFilters} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Step 3: Treatment</p>
          <TreatmentSelectionList filters={filters} setFilters={setFilters} compact />
        </div>
      </div>
    </section>
  )
}

const AppliedTagsControls: React.FC<SharedControlsProps> = ({ filters, setFilters }) => {
  const selectedTags = [
    ...(filters.specialtyParent
      ? [`Specialty: ${SPECIALTY_PARENT_LABEL_BY_VALUE.get(filters.specialtyParent) ?? filters.specialtyParent}`]
      : []),
    ...(filters.specialtyChild
      ? [`Subspecialty: ${SPECIALTY_CHILD_LABEL_BY_VALUE.get(filters.specialtyChild) ?? filters.specialtyChild}`]
      : []),
    ...filters.treatments.map((treatment) => `Treatment: ${TREATMENT_LABEL_BY_VALUE.get(treatment) ?? treatment}`),
    ...filters.cities.map((city) => `City: ${city}`),
  ]

  return (
    <section className="space-y-3">
      <Label className="text-sm font-semibold">Applied Filter Tags</Label>
      <div className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.length === 0 ? <span className="text-xs text-muted-foreground">No filters active.</span> : null}
          {selectedTags.map((tag) => (
            <span key={tag} className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-[11px]">
              {tag}
            </span>
          ))}
          {selectedTags.length > 0 ? (
            <button
              type="button"
              className="rounded-full border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted/40"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  specialtyParent: null,
                  specialtyChild: null,
                  treatments: [],
                  cities: [],
                }))
              }
            >
              Clear tags
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Specialty</p>
          <ParentSelectorButtons filters={filters} setFilters={setFilters} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Subspecialty</p>
          <ChildSelectorButtons filters={filters} setFilters={setFilters} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Treatment</p>
          <TreatmentSelectionList filters={filters} setFilters={setFilters} compact />
        </div>
      </div>
    </section>
  )
}

type CollapsibleFilterSectionProps = {
  label: string
  summary?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

const CollapsibleFilterSection: React.FC<CollapsibleFilterSectionProps> = ({
  label,
  summary,
  isOpen,
  onToggle,
  children,
}) => {
  return (
    <section className="space-y-1.5">
      <button
        type="button"
        className="group flex w-full cursor-pointer items-center justify-between gap-2 px-1 py-1 text-left"
        onClick={onToggle}
      >
        <span className="text-sm font-semibold text-foreground group-hover:text-primary">{label}</span>
        <span className="flex items-center gap-2">
          {!isOpen && summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}
          <span
            aria-hidden="true"
            className={cn(
              'text-base leading-none font-bold text-foreground transition-colors group-hover:text-primary',
            )}
          >
            {isOpen ? '−' : '+'}
          </span>
        </span>
      </button>

      {isOpen ? <div className="rounded-lg border border-border bg-background px-3 py-3">{children}</div> : null}
    </section>
  )
}

const DropdownToolbarControls: React.FC<SharedControlsProps> = ({ filters, setFilters }) => {
  const [openSection, setOpenSection] = React.useState<'parent' | 'child' | 'treatment' | null>('parent')
  const selectedParentLabel =
    filters.specialtyParent === null
      ? 'All'
      : (SPECIALTY_PARENT_LABEL_BY_VALUE.get(filters.specialtyParent) ?? filters.specialtyParent)

  const selectedChildLabel =
    filters.specialtyChild === null
      ? 'All'
      : (SPECIALTY_CHILD_LABEL_BY_VALUE.get(filters.specialtyChild) ?? filters.specialtyChild)

  return (
    <section className="space-y-3">
      <Label className="text-sm font-semibold">Dropdown Toolbar</Label>
      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-muted/40"
          onClick={() => setOpenSection((current) => (current === 'parent' ? null : 'parent'))}
        >
          <span>Specialty: {selectedParentLabel}</span>
          <span>{openSection === 'parent' ? '−' : '+'}</span>
        </button>
        {openSection === 'parent' ? (
          <div className="rounded-md border border-border bg-background p-2">
            <ParentSelectorButtons filters={filters} setFilters={setFilters} />
          </div>
        ) : null}

        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-muted/40"
          onClick={() => setOpenSection((current) => (current === 'child' ? null : 'child'))}
        >
          <span>Subspecialty: {selectedChildLabel}</span>
          <span>{openSection === 'child' ? '−' : '+'}</span>
        </button>
        {openSection === 'child' ? (
          <div className="rounded-md border border-border bg-background p-2">
            <ChildSelectorButtons filters={filters} setFilters={setFilters} />
          </div>
        ) : null}

        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-muted/40"
          onClick={() => setOpenSection((current) => (current === 'treatment' ? null : 'treatment'))}
        >
          <span>Treatments ({filters.treatments.length})</span>
          <span>{openSection === 'treatment' ? '−' : '+'}</span>
        </button>
        {openSection === 'treatment' ? (
          <div className="rounded-md border border-border bg-background p-2">
            <TreatmentSelectionList filters={filters} setFilters={setFilters} compact />
          </div>
        ) : null}
      </div>
    </section>
  )
}

const DropdownToolbarUnifiedControls: React.FC<SharedControlsProps> = ({ filters, setFilters }) => {
  const [openSection, setOpenSection] = React.useState<{
    parent: boolean
    child: boolean
    treatment: boolean
  }>({
    parent: true,
    child: true,
    treatment: true,
  })

  const visibleChildren = getChildSpecialtiesForParent(filters.specialtyParent)
  const visibleTreatmentGroups = getTreatmentGroupsForSelection(filters.specialtyParent, filters.specialtyChild)

  const selectedParentLabel =
    filters.specialtyParent === null
      ? 'All'
      : (SPECIALTY_PARENT_LABEL_BY_VALUE.get(filters.specialtyParent) ?? filters.specialtyParent)

  const selectedChildLabel =
    filters.specialtyChild === null
      ? 'All'
      : (SPECIALTY_CHILD_LABEL_BY_VALUE.get(filters.specialtyChild) ?? filters.specialtyChild)

  const toggleSection = (section: keyof typeof openSection) => {
    setOpenSection((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  return (
    <section className="space-y-3">
      <Label className="text-sm font-semibold">Specialty & Treatment</Label>
      <CollapsibleFilterSection
        label="Medical Specialty"
        summary={openSection.parent ? undefined : selectedParentLabel}
        isOpen={openSection.parent}
        onToggle={() => toggleSection('parent')}
      >
        <div className="space-y-2">
          <CheckboxWithLabel
            label="All specialties"
            checked={filters.specialtyParent === null}
            onCheckedChange={(checked) => {
              if (!checked) return
              selectParentSpecialty(setFilters, null)
            }}
          />
          {SPECIALTY_PARENTS.map((parent) => (
            <CheckboxWithLabel
              key={parent.value}
              label={parent.label}
              checked={filters.specialtyParent === parent.value}
              onCheckedChange={(checked) => {
                if (checked) {
                  selectParentSpecialty(setFilters, parent.value)
                  return
                }

                if (filters.specialtyParent === parent.value) {
                  selectParentSpecialty(setFilters, null)
                }
              }}
            />
          ))}
        </div>
      </CollapsibleFilterSection>

      <CollapsibleFilterSection
        label="Subspecialty"
        summary={openSection.child ? undefined : selectedChildLabel}
        isOpen={openSection.child}
        onToggle={() => toggleSection('child')}
      >
        <div className="space-y-2">
          <CheckboxWithLabel
            label="All subspecialties"
            checked={filters.specialtyChild === null}
            onCheckedChange={(checked) => {
              if (!checked) return
              selectChildSpecialty(setFilters, null)
            }}
          />
          {visibleChildren.map((child) => (
            <CheckboxWithLabel
              key={child.value}
              label={child.label}
              checked={filters.specialtyChild === child.value}
              onCheckedChange={(checked) => {
                if (checked) {
                  selectChildSpecialty(setFilters, child.value)
                  return
                }

                if (filters.specialtyChild === child.value) {
                  selectChildSpecialty(setFilters, null)
                }
              }}
            />
          ))}

          {visibleChildren.length === 0 ? (
            <p className="text-xs text-muted-foreground">Select a parent specialty to see subspecialties.</p>
          ) : null}
        </div>
      </CollapsibleFilterSection>

      <CollapsibleFilterSection
        label="Treatment"
        summary={
          openSection.treatment
            ? undefined
            : filters.treatments.length > 0
              ? `${filters.treatments.length} selected`
              : 'All'
        }
        isOpen={openSection.treatment}
        onToggle={() => toggleSection('treatment')}
      >
        <div className="space-y-3">
          {visibleTreatmentGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">No treatments available for the current specialty scope.</p>
          ) : null}

          {visibleTreatmentGroups.map((group) => (
            <div key={group.child.value} className="space-y-2">
              {filters.specialtyChild === null ? (
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.child.label}
                </p>
              ) : null}

              <div className="space-y-2">
                {group.treatments.map((treatment) => (
                  <CheckboxWithLabel
                    key={treatment.value}
                    label={treatment.label}
                    checked={filters.treatments.includes(treatment.value)}
                    onCheckedChange={() => toggleTreatmentSelection(setFilters, treatment.value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleFilterSection>
    </section>
  )
}

type InternetConceptFiltersPanelProps = {
  variant: InternetConceptVariant
  filters: InternetFilterState
  setFilters: React.Dispatch<React.SetStateAction<InternetFilterState>>
  maxPrice: number
}

const InternetConceptFiltersPanel: React.FC<InternetConceptFiltersPanelProps> = ({
  variant,
  filters,
  setFilters,
  maxPrice,
}) => {
  const [openBaseSections, setOpenBaseSections] = React.useState({
    city: true,
    waitTime: true,
  })

  const toggleBaseSection = (section: keyof typeof openBaseSections) => {
    setOpenBaseSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  const conceptControls = (() => {
    switch (variant) {
      case 'two-step':
        return <TwoStepControls filters={filters} setFilters={setFilters} />
      case 'applied-tags':
        return <AppliedTagsControls filters={filters} setFilters={setFilters} />
      case 'dropdown-toolbar':
        return <DropdownToolbarControls filters={filters} setFilters={setFilters} />
      case 'dropdown-toolbar-unified':
        return <DropdownToolbarUnifiedControls filters={filters} setFilters={setFilters} />
      default:
        return null
    }
  })()

  if (variant === 'dropdown-toolbar-unified') {
    return (
      <ListingFilters.Root
        defaultPriceRange={filters.priceRange}
        priceBounds={{ min: 0, max: maxPrice }}
        defaultRating={filters.rating}
        onPriceChange={(nextPriceRange) =>
          setFilters((current) => ({
            ...current,
            priceRange: clampPriceRange(nextPriceRange, { min: 0, max: maxPrice }),
          }))
        }
        onRatingChange={(nextRating) => setFilters((current) => ({ ...current, rating: nextRating }))}
      >
        <ListingFilters.Price />

        <CollapsibleFilterSection
          label="City"
          summary={filters.cities.length > 0 ? `${filters.cities.length} selected` : 'All'}
          isOpen={openBaseSections.city}
          onToggle={() => toggleBaseSection('city')}
        >
          <div className="space-y-2">
            {CITY_OPTIONS.map((city) => (
              <CheckboxWithLabel
                key={city.value}
                label={city.label}
                checked={filters.cities.includes(city.value)}
                onCheckedChange={(checked) =>
                  setFilters((current) => ({
                    ...current,
                    cities: toggleValueInSelection(current.cities, city.value, checked),
                  }))
                }
              />
            ))}
          </div>
        </CollapsibleFilterSection>

        <CollapsibleFilterSection
          label="Wait time"
          summary={filters.waitTimes.length > 0 ? `${filters.waitTimes.length} selected` : 'All'}
          isOpen={openBaseSections.waitTime}
          onToggle={() => toggleBaseSection('waitTime')}
        >
          <div className="space-y-2">
            {WAIT_TIME_CHECKBOX_OPTIONS.map((wait) => (
              <CheckboxWithLabel
                key={wait.value}
                label={wait.label}
                checked={filters.waitTimes.includes(wait.value)}
                onCheckedChange={(checked) =>
                  setFilters((current) => ({
                    ...current,
                    waitTimes: toggleValueInSelection(current.waitTimes, wait.value, checked),
                  }))
                }
              />
            ))}
          </div>
        </CollapsibleFilterSection>

        {conceptControls}
        <ListingFilters.Rating />
      </ListingFilters.Root>
    )
  }

  return (
    <ListingFilters.Root
      defaultPriceRange={filters.priceRange}
      priceBounds={{ min: 0, max: maxPrice }}
      defaultRating={filters.rating}
      onPriceChange={(nextPriceRange) =>
        setFilters((current) => ({
          ...current,
          priceRange: clampPriceRange(nextPriceRange, { min: 0, max: maxPrice }),
        }))
      }
      onRatingChange={(nextRating) => setFilters((current) => ({ ...current, rating: nextRating }))}
    >
      <ListingFilters.Price />
      <ListingFilters.CheckboxGroup
        label="City"
        options={CITY_OPTIONS}
        value={filters.cities}
        onValueChange={(nextCities) => setFilters((current) => ({ ...current, cities: nextCities }))}
      />
      <ListingFilters.CheckboxGroup
        label="Wait time"
        options={WAIT_TIME_CHECKBOX_OPTIONS}
        value={filters.waitTimes}
        onValueChange={(nextWaitTimes) => setFilters((current) => ({ ...current, waitTimes: nextWaitTimes }))}
      />
      {conceptControls}
      <ListingFilters.Rating />
    </ListingFilters.Root>
  )
}

type JourneyPresetSelectorProps = {
  activePreset: JourneyPresetId
  onPresetChange: (presetId: JourneyPresetId) => void
}

const JourneyPresetSelector: React.FC<JourneyPresetSelectorProps> = ({ activePreset, onPresetChange }) => {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Entry preset</p>
      <div className="flex flex-wrap gap-1.5">
        {JOURNEY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] transition-colors',
              activePreset === preset.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40',
            )}
            onClick={() => onPresetChange(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}

type InternetConceptHarnessProps = {
  variant: InternetConceptVariant
}

const InternetConceptHarness: React.FC<InternetConceptHarnessProps> = ({ variant }) => {
  const maxPrice = React.useMemo(() => {
    return RESULTS.reduce((currentMax, clinic) => {
      const price = clinic.priceFrom?.value
      if (typeof price !== 'number' || !Number.isFinite(price)) return currentMax
      return Math.max(currentMax, price)
    }, 0)
  }, [])

  const [activeJourneyPreset, setActiveJourneyPreset] = React.useState<JourneyPresetId>('landing-treatment')
  const [filters, setFilters] = React.useState<InternetFilterState>(() => {
    const defaultPreset = JOURNEY_PRESET_BY_ID.get('landing-treatment')
    return defaultPreset ? buildFilterStateFromJourneyPreset(defaultPreset, maxPrice) : defaultFilters(maxPrice)
  })
  const [sortBy, setSortBy] = React.useState<SortOption>('rank')

  React.useEffect(() => {
    setFilters((current) => ({
      ...current,
      priceRange: clampPriceRange(current.priceRange, { min: 0, max: maxPrice }),
    }))
  }, [maxPrice])

  const applyJourneyPreset = React.useCallback(
    (presetId: JourneyPresetId) => {
      const preset = JOURNEY_PRESET_BY_ID.get(presetId)
      if (!preset) return

      setActiveJourneyPreset(presetId)
      setFilters(buildFilterStateFromJourneyPreset(preset, maxPrice))
    },
    [maxPrice],
  )

  const filteredResults = React.useMemo(() => applyFilters(RESULTS, filters), [filters])
  const sortedResults = React.useMemo(() => sortListingComparison(filteredResults, sortBy), [filteredResults, sortBy])
  const breadcrumbItems = React.useMemo(() => buildBreadcrumbItems(filters), [filters])
  const activePreset = JOURNEY_PRESET_BY_ID.get(activeJourneyPreset)
  const listingPreviewHref = React.useMemo(() => buildListingPreviewHref(filters), [filters])

  return (
    <ListingComparison
      hero={{
        title: 'Compare clinic prices',
        subtitle: 'Existing listing layout with corrected 3-level medical taxonomy',
        features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
        bulletStyle: 'circle',
      }}
      filters={
        <InternetConceptFiltersPanel variant={variant} filters={filters} setFilters={setFilters} maxPrice={maxPrice} />
      }
      results={sortedResults}
      totalResultsCount={sortedResults.length}
      sortControl={<SortControl value={sortBy} onValueChange={setSortBy} options={SORT_OPTIONS} />}
      resultsContext={
        <div className="space-y-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{CONCEPT_VARIANT_LABELS[variant]}</p>
          <JourneyPresetSelector activePreset={activeJourneyPreset} onPresetChange={applyJourneyPreset} />
          <p>
            Landing entry URL:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">
              {activePreset?.href ?? '/listing-comparison'}
            </code>
          </p>
          <p>
            Current listing URL:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">{listingPreviewHref}</code>
          </p>
          {breadcrumbItems.length > 0 ? (
            <Breadcrumb items={breadcrumbItems} className="text-xs" />
          ) : (
            <p className="text-[11px]">Overview state: no breadcrumb, matching the current listing behavior.</p>
          )}

          <div className="rounded-md border border-border/70 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
            <p>
              Active scope:{' '}
              {filters.specialtyParent
                ? `Parent ${SPECIALTY_PARENT_LABEL_BY_VALUE.get(filters.specialtyParent) ?? filters.specialtyParent}`
                : 'All parents'}
              {' / '}
              {filters.specialtyChild
                ? `Child ${SPECIALTY_CHILD_LABEL_BY_VALUE.get(filters.specialtyChild) ?? filters.specialtyChild}`
                : 'All child specialties'}
              {' / '}
              {filters.treatments.length > 0
                ? `${filters.treatments.length} treatment${filters.treatments.length > 1 ? 's' : ''}`
                : 'All treatments'}
            </p>
          </div>
        </div>
      }
      emptyState={
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No clinics match the current filters.
        </div>
      }
      trust={TRUST_SECTION_PROPS}
    />
  )
}

const meta = {
  title: 'Templates/ListingComparison/Medical Specialty Variants',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Four listing variants with corrected taxonomy: Parent Specialty -> Child Specialty -> Treatment.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const TwoStepInListing: Story = {
  render: () => <InternetConceptHarness variant="two-step" />,
}

export const AppliedTagsInListing: Story = {
  render: () => <InternetConceptHarness variant="applied-tags" />,
}

export const DropdownToolbarInListing: Story = {
  render: () => <InternetConceptHarness variant="dropdown-toolbar" />,
}

export const DropdownToolbarUnifiedInListing: Story = {
  render: () => <InternetConceptHarness variant="dropdown-toolbar-unified" />,
}
