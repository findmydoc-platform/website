'use client'

import * as React from 'react'

import { CheckboxWithLabel } from '@/components/molecules/CheckboxWithLabel'
import { ListingFilters } from '@/components/organisms/Listing'
import type { RatingFilterValue } from '@/components/molecules/RatingFilter'
import type { CheckboxOption } from '@/components/molecules/CheckboxGroup'
import { clampPriceRange, normalizePriceBounds, type PriceBounds } from '@/utilities/listingComparison/priceRange'
import { cn } from '@/utilities/ui'

type ListingSpecialtyOption = {
  value: string
  label: string
  depth: number
  parentValue: string | null
}

type ListingTreatmentOption = {
  value: string
  label: string
  disabled?: boolean
}

type ListingTreatmentGroup = {
  specialty: ListingSpecialtyOption
  options: ListingTreatmentOption[]
}

type NormalizedCheckboxOption = {
  value: string
  label: string
  disabled: boolean
}

type ListingComparisonFilterValues = {
  cities: string[]
  specialty: string | null
  waitTimes: Array<{ minWeeks: number; maxWeeks?: number }>
  treatments: string[]
  priceRange: [number, number]
  rating: RatingFilterValue
}

export type ListingComparisonFiltersProps = {
  cityOptions?: CheckboxOption[]
  specialtyOptions?: ListingSpecialtyOption[]
  waitTimeOptions?: Array<{ label: string; minWeeks: number; maxWeeks?: number }>
  treatmentGroups?: ListingTreatmentGroup[]
  priceBounds?: PriceBounds
  initialValues?: ListingComparisonFilterValues
  onChange?: (filters: ListingComparisonFilterValues) => void
}

type CollapsibleFilterSectionProps = {
  label: string
  summary?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function deduplicateSelections(values: string[]): string[] {
  const seen = new Set<string>()
  const uniqueValues: string[] = []

  values.forEach((value) => {
    if (seen.has(value)) return
    seen.add(value)
    uniqueValues.push(value)
  })

  return uniqueValues
}

function hasSameSelectionSequence(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function toggleValueInSelection(values: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return deduplicateSelections([...values, value])
  }

  return values.filter((existingValue) => existingValue !== value)
}

function collectDescendantSpecialtyValues(seed: string, childrenByParent: Map<string, string[]>): Set<string> {
  const queue = [seed]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue

    visited.add(current)
    const children = childrenByParent.get(current) ?? []
    children.forEach((child) => {
      if (!visited.has(child)) {
        queue.push(child)
      }
    })
  }

  return visited
}

function normalizeCheckboxOption(option: CheckboxOption): NormalizedCheckboxOption {
  if (typeof option === 'string') {
    return {
      value: option,
      label: option,
      disabled: false,
    }
  }

  return {
    value: option.value,
    label: option.label,
    disabled: Boolean(option.disabled),
  }
}

function resolveRootSpecialtyValue(
  selectedSpecialty: string | null,
  specialtyByValue: Map<string, ListingSpecialtyOption>,
): string | null {
  if (!selectedSpecialty) return null

  let cursor: string | null = selectedSpecialty
  const visited = new Set<string>()

  while (cursor) {
    if (visited.has(cursor)) break
    visited.add(cursor)

    const option = specialtyByValue.get(cursor)
    if (!option) return null
    if (!option.parentValue) return option.value

    cursor = option.parentValue
  }

  return null
}

function resolveSelectedChildSpecialtyValue(
  selectedSpecialty: string | null,
  specialtyByValue: Map<string, ListingSpecialtyOption>,
): string | null {
  if (!selectedSpecialty) return null

  const option = specialtyByValue.get(selectedSpecialty)
  if (!option) return null
  if (!option.parentValue) return null

  return option.value
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
        aria-expanded={isOpen}
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

export function ListingComparisonFilters({
  cityOptions = [],
  specialtyOptions = [],
  waitTimeOptions = [],
  treatmentGroups = [],
  priceBounds,
  initialValues,
  onChange,
}: ListingComparisonFiltersProps) {
  const normalizedPriceBounds = React.useMemo(() => normalizePriceBounds(priceBounds), [priceBounds])
  const activePriceBounds = React.useMemo(
    () => ({
      min: normalizedPriceBounds.min,
      max: normalizedPriceBounds.max,
    }),
    [normalizedPriceBounds.max, normalizedPriceBounds.min],
  )
  const initialPriceRange = clampPriceRange(
    initialValues?.priceRange ?? [activePriceBounds.min, activePriceBounds.max],
    activePriceBounds,
  )

  const [openSections, setOpenSections] = React.useState({
    city: false,
    waitTime: false,
    medicalSpecialty: false,
    subspecialty: false,
    treatment: false,
  })

  const [cities, setCities] = React.useState<string[]>(initialValues?.cities ?? [])
  const [specialty, setSpecialty] = React.useState<string | null>(initialValues?.specialty ?? null)
  const [waitTimes, setWaitTimes] = React.useState<string[]>(
    (initialValues?.waitTimes ?? []).flatMap((range) => {
      const match = waitTimeOptions.find(
        (option) => option.minWeeks === range.minWeeks && option.maxWeeks === range.maxWeeks,
      )
      return match ? [match.label] : []
    }),
  )
  const [treatments, setTreatments] = React.useState<string[]>(initialValues?.treatments ?? [])
  const [priceRange, setPriceRange] = React.useState<[number, number]>(initialPriceRange)
  const [rating, setRating] = React.useState<RatingFilterValue>(initialValues?.rating ?? null)

  const normalizedCityOptions = React.useMemo(
    () => cityOptions.map((option) => normalizeCheckboxOption(option)),
    [cityOptions],
  )

  const normalizedWaitTimeOptions = React.useMemo(
    () => waitTimeOptions.map((option) => ({ value: option.label, label: option.label })),
    [waitTimeOptions],
  )

  const specialtyOptionByValue = React.useMemo(
    () => new Map(specialtyOptions.map((option) => [option.value, option])),
    [specialtyOptions],
  )

  const parentSpecialtyOptions = React.useMemo(
    () => specialtyOptions.filter((option) => option.parentValue === null),
    [specialtyOptions],
  )

  const childSpecialtyOptions = React.useMemo(
    () => specialtyOptions.filter((option) => option.parentValue !== null),
    [specialtyOptions],
  )

  const treatmentSpecialtyByValue = React.useMemo(() => {
    const map = new Map<string, string>()
    treatmentGroups.forEach((group) => {
      group.options.forEach((option) => {
        map.set(option.value, group.specialty.value)
      })
    })
    return map
  }, [treatmentGroups])

  const specialtyValues = React.useMemo(
    () => new Set(specialtyOptions.map((option) => option.value)),
    [specialtyOptions],
  )

  const childrenBySpecialty = React.useMemo(() => {
    const map = new Map<string, string[]>()
    specialtyOptions.forEach((option) => {
      if (!option.parentValue) return
      const siblings = map.get(option.parentValue) ?? []
      siblings.push(option.value)
      map.set(option.parentValue, siblings)
    })
    return map
  }, [specialtyOptions])

  const specialtyScopeByValue = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    specialtyOptions.forEach((option) => {
      map.set(option.value, collectDescendantSpecialtyValues(option.value, childrenBySpecialty))
    })
    return map
  }, [childrenBySpecialty, specialtyOptions])

  const waitTimeByLabel = React.useMemo(() => {
    return new Map(waitTimeOptions.map((option) => [option.label, option]))
  }, [waitTimeOptions])

  const selectedParentSpecialty = React.useMemo(
    () => resolveRootSpecialtyValue(specialty, specialtyOptionByValue),
    [specialty, specialtyOptionByValue],
  )

  const selectedChildSpecialty = React.useMemo(
    () => resolveSelectedChildSpecialtyValue(specialty, specialtyOptionByValue),
    [specialty, specialtyOptionByValue],
  )

  const visibleChildSpecialtyOptions = React.useMemo(() => {
    if (!selectedParentSpecialty) {
      return childSpecialtyOptions
    }

    const children = childrenBySpecialty.get(selectedParentSpecialty) ?? []

    return children
      .map((childValue) => specialtyOptionByValue.get(childValue))
      .filter((child): child is ListingSpecialtyOption => Boolean(child))
  }, [childSpecialtyOptions, childrenBySpecialty, selectedParentSpecialty, specialtyOptionByValue])

  const visibleTreatmentGroups = React.useMemo(() => {
    if (!selectedParentSpecialty) {
      return treatmentGroups
    }

    if (selectedChildSpecialty) {
      return treatmentGroups.filter((group) => group.specialty.value === selectedChildSpecialty)
    }

    const allowedSpecialties = specialtyScopeByValue.get(selectedParentSpecialty) ?? new Set([selectedParentSpecialty])
    return treatmentGroups.filter((group) => allowedSpecialties.has(group.specialty.value))
  }, [selectedChildSpecialty, selectedParentSpecialty, specialtyScopeByValue, treatmentGroups])

  const onChangeRef = React.useRef<typeof onChange>(onChange)
  // Update ref synchronously during render (standard pattern for storing latest callback)
  onChangeRef.current = onChange

  const toggleOpenSection = React.useCallback((section: keyof typeof openSections) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }, [])

  React.useEffect(() => {
    setPriceRange((currentRange) => clampPriceRange(currentRange, activePriceBounds))
  }, [activePriceBounds])

  React.useEffect(() => {
    if (!specialty) return
    if (specialtyValues.has(specialty)) return

    setSpecialty(null)
    setTreatments([])
  }, [specialty, specialtyValues])

  React.useEffect(() => {
    setTreatments((currentTreatments) => {
      const nextTreatments = currentTreatments.filter((value) => treatmentSpecialtyByValue.has(value))
      return hasSameSelectionSequence(currentTreatments, nextTreatments) ? currentTreatments : nextTreatments
    })
  }, [treatmentSpecialtyByValue])

  const handleSpecialtyChange = React.useCallback(
    (nextSpecialty: string | null) => {
      if (nextSpecialty === null) {
        setSpecialty(null)
        setTreatments([])
        return
      }

      const allowedSpecialties = specialtyScopeByValue.get(nextSpecialty) ?? new Set([nextSpecialty])

      setSpecialty(nextSpecialty)
      setTreatments((currentTreatments) =>
        currentTreatments.filter((value) => {
          const treatmentSpecialty = treatmentSpecialtyByValue.get(value)
          return treatmentSpecialty ? allowedSpecialties.has(treatmentSpecialty) : false
        }),
      )
    },
    [specialtyScopeByValue, treatmentSpecialtyByValue],
  )

  const handleTreatmentToggle = React.useCallback(
    (treatmentValue: string, checked: boolean) => {
      const treatmentSpecialty = treatmentSpecialtyByValue.get(treatmentValue)
      if (!treatmentSpecialty) {
        setTreatments((currentTreatments) => toggleValueInSelection(currentTreatments, treatmentValue, checked))
        return
      }

      if (checked) {
        if (specialty === null || specialty !== treatmentSpecialty) {
          setSpecialty(treatmentSpecialty)
          setTreatments([treatmentValue])
          return
        }

        setTreatments((currentTreatments) => toggleValueInSelection(currentTreatments, treatmentValue, true))
        return
      }

      setTreatments((currentTreatments) => toggleValueInSelection(currentTreatments, treatmentValue, false))
    },
    [specialty, treatmentSpecialtyByValue],
  )

  React.useEffect(() => {
    if (!onChangeRef.current) return
    const ranges = waitTimes.flatMap((label) => {
      const option = waitTimeByLabel.get(label)
      return option ? [{ minWeeks: option.minWeeks, maxWeeks: option.maxWeeks }] : []
    })

    onChangeRef.current({
      cities,
      specialty,
      waitTimes: ranges,
      treatments,
      priceRange,
      rating,
    })
  }, [cities, priceRange, rating, specialty, treatments, waitTimes, waitTimeByLabel])

  return (
    <ListingFilters.Root
      defaultPriceRange={initialPriceRange}
      priceBounds={activePriceBounds}
      defaultRating={initialValues?.rating ?? null}
      onPriceChange={(nextRange) => setPriceRange(clampPriceRange(nextRange, activePriceBounds))}
      onRatingChange={setRating}
    >
      <ListingFilters.Price />

      {normalizedCityOptions.length > 0 ? (
        <CollapsibleFilterSection
          label="City"
          summary={cities.length > 0 ? `${cities.length} selected` : 'All'}
          isOpen={openSections.city}
          onToggle={() => toggleOpenSection('city')}
        >
          <div className="space-y-2">
            {normalizedCityOptions.map((option) => (
              <CheckboxWithLabel
                key={option.value}
                label={option.label}
                checked={cities.includes(option.value)}
                disabled={option.disabled}
                onCheckedChange={(checked) => {
                  if (option.disabled) return
                  setCities((currentCities) => toggleValueInSelection(currentCities, option.value, checked))
                }}
              />
            ))}
          </div>
        </CollapsibleFilterSection>
      ) : null}

      {normalizedWaitTimeOptions.length > 0 ? (
        <CollapsibleFilterSection
          label="Wait time"
          summary={waitTimes.length > 0 ? `${waitTimes.length} selected` : 'All'}
          isOpen={openSections.waitTime}
          onToggle={() => toggleOpenSection('waitTime')}
        >
          <div className="space-y-2">
            {normalizedWaitTimeOptions.map((option) => (
              <CheckboxWithLabel
                key={option.value}
                label={option.label}
                checked={waitTimes.includes(option.value)}
                onCheckedChange={(checked) =>
                  setWaitTimes((currentWaitTimes) => toggleValueInSelection(currentWaitTimes, option.value, checked))
                }
              />
            ))}
          </div>
        </CollapsibleFilterSection>
      ) : null}

      {specialtyOptions.length > 0 ? (
        <>
          <CollapsibleFilterSection
            label="Medical Specialty"
            summary={
              selectedParentSpecialty
                ? (specialtyOptionByValue.get(selectedParentSpecialty)?.label ?? selectedParentSpecialty)
                : 'All'
            }
            isOpen={openSections.medicalSpecialty}
            onToggle={() => toggleOpenSection('medicalSpecialty')}
          >
            <div className="space-y-2">
              <CheckboxWithLabel
                label="All specialties"
                checked={specialty === null}
                onCheckedChange={(checked) => {
                  if (!checked) return
                  handleSpecialtyChange(null)
                }}
              />

              {parentSpecialtyOptions.map((option) => (
                <CheckboxWithLabel
                  key={option.value}
                  label={option.label}
                  checked={selectedParentSpecialty === option.value}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleSpecialtyChange(option.value)
                      return
                    }

                    if (selectedParentSpecialty === option.value) {
                      handleSpecialtyChange(null)
                    }
                  }}
                />
              ))}
            </div>
          </CollapsibleFilterSection>

          <CollapsibleFilterSection
            label="Subspecialty"
            summary={
              selectedChildSpecialty
                ? (specialtyOptionByValue.get(selectedChildSpecialty)?.label ?? selectedChildSpecialty)
                : 'All'
            }
            isOpen={openSections.subspecialty}
            onToggle={() => toggleOpenSection('subspecialty')}
          >
            <div className="space-y-2">
              <CheckboxWithLabel
                label="All subspecialties"
                checked={selectedChildSpecialty === null}
                onCheckedChange={(checked) => {
                  if (!checked) return
                  handleSpecialtyChange(selectedParentSpecialty)
                }}
              />

              {visibleChildSpecialtyOptions.map((option) => (
                <CheckboxWithLabel
                  key={option.value}
                  label={option.label}
                  checked={selectedChildSpecialty === option.value}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleSpecialtyChange(option.value)
                      return
                    }

                    if (selectedChildSpecialty === option.value) {
                      handleSpecialtyChange(selectedParentSpecialty)
                    }
                  }}
                />
              ))}

              {visibleChildSpecialtyOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Select a parent specialty to see subspecialties.</p>
              ) : null}
            </div>
          </CollapsibleFilterSection>
        </>
      ) : null}

      {treatmentGroups.length > 0 ? (
        <CollapsibleFilterSection
          label="Treatment"
          summary={treatments.length > 0 ? `${treatments.length} selected` : 'All'}
          isOpen={openSections.treatment}
          onToggle={() => toggleOpenSection('treatment')}
        >
          <div className="space-y-3">
            {visibleTreatmentGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">No treatments available for the current specialty scope.</p>
            ) : null}

            {visibleTreatmentGroups.map((group) => (
              <div key={group.specialty.value} className="space-y-2">
                {selectedChildSpecialty === null ? (
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.specialty.label}
                  </p>
                ) : null}

                <div className="space-y-2">
                  {group.options.map((option) => (
                    <CheckboxWithLabel
                      key={option.value}
                      label={option.label}
                      checked={treatments.includes(option.value)}
                      disabled={Boolean(option.disabled)}
                      onCheckedChange={(checked) => {
                        if (option.disabled) return
                        handleTreatmentToggle(option.value, checked)
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleFilterSection>
      ) : null}

      <ListingFilters.Rating />
    </ListingFilters.Root>
  )
}
