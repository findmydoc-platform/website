'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { UiLink } from '@/components/molecules/Link'
import { cn } from '@/utilities/ui'

import {
  ALL_CATEGORY_VALUE,
  SLOT_BOTTOM_RIGHT_LEFT_QUARTER,
  SLOT_BOTTOM_RIGHT_RIGHT_QUARTER,
  SLOT_HIDDEN,
  SLOT_LARGE_LEFT,
  SLOT_TOP_RIGHT_HALF,
  buildCategoryTabs,
  createParkingSlotOrder,
  type LandingCategory,
  type LandingCategoriesProps,
  withSpecialtyQuery,
} from './LandingCategories.shared'

type LandingCategoriesShellItem = {
  id: string
  categories: string[]
  card: React.ReactNode
}

type LandingCategoriesShellProps = {
  baseHref: string
  categories: LandingCategory[]
  defaultActiveFilter?: string
  featuredIds?: string[]
  items: LandingCategoriesShellItem[]
  moreCategoriesLink?: LandingCategoriesProps['moreCategoriesLink']
}

export function LandingCategoriesShell({
  baseHref,
  categories,
  defaultActiveFilter,
  featuredIds,
  items,
  moreCategoriesLink,
}: LandingCategoriesShellProps) {
  const categoryTabs = useMemo(() => {
    return buildCategoryTabs(categories)
  }, [categories])

  const categoryFilters = useMemo(() => {
    return new Set(categoryTabs.map((category) => category.value))
  }, [categoryTabs])

  const preferredDefault =
    typeof defaultActiveFilter === 'string' && categoryFilters.has(defaultActiveFilter)
      ? defaultActiveFilter
      : ALL_CATEGORY_VALUE

  const [activeFilter, setActiveFilter] = useState(preferredDefault)

  useEffect(() => {
    if (!categoryFilters.has(activeFilter)) {
      setActiveFilter(ALL_CATEGORY_VALUE)
    }
  }, [activeFilter, categoryFilters])

  const categoryValueSet = useMemo(() => {
    return new Set(
      categoryTabs.filter((category) => category.value !== ALL_CATEGORY_VALUE).map((category) => category.value),
    )
  }, [categoryTabs])

  const scopedItems = useMemo(() => {
    if (categoryValueSet.size === 0) return items
    return items.filter((item) => item.categories.some((category) => categoryValueSet.has(category)))
  }, [categoryValueSet, items])

  const resolvedFilter = categoryTabs.some((category) => category.value === activeFilter)
    ? activeFilter
    : ALL_CATEGORY_VALUE
  const panelId = 'landing-categories-panel'
  const activeTabId = `landing-categories-tab-${resolvedFilter}`
  const categoryLabelMap = useMemo(() => {
    return new Map(categoryTabs.map((category) => [category.value, category.label]))
  }, [categoryTabs])

  const parkingSlotMap = useMemo(() => {
    const map = new Map<string, string>()
    const orderedParkingSlots = createParkingSlotOrder(resolvedFilter)
    const sortedItems = [...scopedItems].sort((left, right) =>
      left.id.localeCompare(right.id, 'en', { sensitivity: 'base' }),
    )

    sortedItems.forEach((item, index) => {
      map.set(item.id, orderedParkingSlots[index % orderedParkingSlots.length] ?? SLOT_HIDDEN)
    })

    for (const item of scopedItems) {
      if (!map.has(item.id)) {
        map.set(item.id, SLOT_HIDDEN)
      }
    }

    return map
  }, [resolvedFilter, scopedItems])

  const curatedItems = useMemo(() => {
    if (!featuredIds?.length) return scopedItems
    return featuredIds
      .map((id) => scopedItems.find((item) => item.id === id))
      .filter((item): item is LandingCategoriesShellItem => Boolean(item))
  }, [featuredIds, scopedItems])

  const visibleItems = useMemo(() => {
    const curatedMatches =
      resolvedFilter === ALL_CATEGORY_VALUE
        ? curatedItems
        : curatedItems.filter((item) => item.categories.includes(resolvedFilter))

    const pool =
      resolvedFilter === ALL_CATEGORY_VALUE
        ? scopedItems
        : scopedItems.filter((item) => item.categories.includes(resolvedFilter))
    const poolSet = new Set(curatedMatches.map((item) => item.id))
    const filler = pool.filter((item) => !poolSet.has(item.id))

    return [...curatedMatches, ...filler].slice(0, 4)
  }, [curatedItems, resolvedFilter, scopedItems])

  const slotItems = useMemo(() => {
    return Array.from({ length: 4 }).map((_, index) => visibleItems[index])
  }, [visibleItems])

  const slotMap = useMemo(() => {
    const map = new Map<string, number>()
    slotItems.forEach((item, index) => {
      if (item) map.set(item.id, index)
    })
    return map
  }, [slotItems])

  const activeLabel = categoryLabelMap.get(resolvedFilter)
  const ctaLabel =
    moreCategoriesLink?.label ??
    (resolvedFilter === ALL_CATEGORY_VALUE ? 'View all clinics' : `More clinics in ${activeLabel ?? 'specialty'}`)
  const ctaHref = withSpecialtyQuery(baseHref, resolvedFilter === ALL_CATEGORY_VALUE ? null : resolvedFilter)

  const slots = [SLOT_LARGE_LEFT, SLOT_TOP_RIGHT_HALF, SLOT_BOTTOM_RIGHT_LEFT_QUARTER, SLOT_BOTTOM_RIGHT_RIGHT_QUARTER]

  return (
    <React.Fragment>
      <nav role="tablist" aria-label="Category filters" className="mb-12 flex flex-wrap justify-center gap-x-8 gap-y-3">
        {categoryTabs.map((category) => {
          const isActive = resolvedFilter === category.value
          const tabId = `landing-categories-tab-${category.value}`

          return (
            <button
              key={category.value}
              id={tabId}
              type="button"
              onClick={() => setActiveFilter(category.value)}
              role="tab"
              aria-selected={isActive}
              aria-pressed={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              className={cn(
                'relative cursor-pointer text-base font-medium transition-colors md:text-lg',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {category.label}
              <span
                className={cn(
                  'absolute -bottom-2 left-0 h-0.5 bg-foreground transition-all duration-300',
                  isActive ? 'w-full' : 'w-0',
                )}
              />
            </button>
          )
        })}
      </nav>

      <div id={panelId} role="tabpanel" aria-labelledby={activeTabId} className="relative mb-12 h-140 w-full">
        {scopedItems.map((item) => {
          const slotIndex = slotMap.get(item.id)
          const hasSlot = slotIndex !== undefined && slotIndex >= 0 && slotIndex < slots.length
          const isVisible = hasSlot
          const slotClass = hasSlot ? slots[slotIndex] : (parkingSlotMap.get(item.id) ?? SLOT_HIDDEN)

          return (
            <div
              key={item.id}
              aria-hidden={!isVisible}
              className={cn(
                'absolute p-3 transition-all duration-700 ease-in-out',
                slotClass,
                isVisible ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0',
                isVisible ? 'z-10' : 'z-0',
              )}
            >
              <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-sm">
                {item.card}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-10 flex justify-center">
        <UiLink
          href={ctaHref}
          label={ctaLabel}
          newTab={moreCategoriesLink?.newTab}
          appearance="secondary"
          hoverEffect="slideFill"
          size="lg"
          className="rounded-full border border-black text-base font-bold text-black"
        />
      </div>
    </React.Fragment>
  )
}
