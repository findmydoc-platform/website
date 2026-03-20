'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { ArrowRight } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { UiLink } from '@/components/molecules/Link'
import { cn } from '@/utilities/ui'

export type LandingCategory = {
  label: string
  value: string
}

export type LandingCategoryItem = {
  id: string
  title: string
  subtitle?: string | null
  categories: string[]
  href?: string
  newTab?: boolean
  image: {
    src: ImageProps['src']
    alt: string
  }
}

export type LandingCategoriesProps = {
  title: string
  description: string
  categories: LandingCategory[]
  items: LandingCategoryItem[]
  activeFilter: string
  onActiveFilterChange: (nextValue: string) => void
  featuredIds?: string[]
  moreCategoriesLink?: {
    href: string
    label?: string | null
    newTab?: boolean
  }
}

const ALL_CATEGORY_VALUE = 'all'
const ALL_CATEGORY_LABEL = 'All'

// Slot layout definitions for the 4-card collage.
// Grid model:
// - Slot 0: left half, full height (primary card)
// - Slot 1: right half, top half
// - Slot 2: right half, bottom-left quarter
// - Slot 3: right half, bottom-right quarter
// Items not assigned to one of these slots are moved to a hidden 0×0 slot.
const SLOT_LARGE_LEFT = 'top-0 left-0 h-full w-1/2'
const SLOT_TOP_RIGHT_HALF = 'top-0 left-1/2 h-1/2 w-1/2'
const SLOT_BOTTOM_RIGHT_LEFT_QUARTER = 'top-1/2 left-1/2 h-1/2 w-1/4'
const SLOT_BOTTOM_RIGHT_RIGHT_QUARTER = 'top-1/2 left-3/4 h-1/2 w-1/4'
const SLOT_HIDDEN = 'top-1/2 left-1/2 h-0 w-0'
const CATEGORY_PARKING_VARIANTS_PER_SIDE = 3
const CATEGORY_PARKING_SLOTS = [
  'top-[-18%] left-[-16%] h-2/5 w-2/5',
  'top-[-8%] left-[-24%] h-1/3 w-1/3',
  'top-[18%] left-[-20%] h-1/3 w-1/3',
  'top-[-18%] left-[76%] h-2/5 w-2/5',
  'top-[-10%] left-[88%] h-1/3 w-1/3',
  'top-[18%] left-[92%] h-1/3 w-1/3',
  'top-[70%] left-[76%] h-2/5 w-2/5',
  'top-[84%] left-[88%] h-1/3 w-1/3',
  'top-[54%] left-[92%] h-1/3 w-1/3',
  'top-[72%] left-[-18%] h-2/5 w-2/5',
  'top-[84%] left-[-24%] h-1/3 w-1/3',
  'top-[54%] left-[-22%] h-1/3 w-1/3',
] as const
const CATEGORY_PARKING_SIDE_GROUPS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
] as const
const CATEGORY_PARKING_SIDE_ORDERS = [
  [0, 1, 2, 3],
  [1, 2, 3, 0],
  [2, 3, 0, 1],
  [3, 0, 1, 2],
] as const

function resolveCategoryParkingSlot(categoryIndex: number, itemIndex: number): string {
  const sideOrder =
    CATEGORY_PARKING_SIDE_ORDERS[categoryIndex % CATEGORY_PARKING_SIDE_ORDERS.length] ?? CATEGORY_PARKING_SIDE_ORDERS[0]
  const sideIndex = sideOrder[itemIndex % sideOrder.length] ?? sideOrder[0] ?? 0
  const sideSlots = CATEGORY_PARKING_SIDE_GROUPS[sideIndex] ?? CATEGORY_PARKING_SIDE_GROUPS[0]
  const variantIndex = Math.floor(itemIndex / sideOrder.length) % CATEGORY_PARKING_VARIANTS_PER_SIDE
  const parkingSlotIndex = sideSlots[variantIndex] ?? sideSlots[0] ?? 0

  return CATEGORY_PARKING_SLOTS[parkingSlotIndex] ?? SLOT_HIDDEN
}

function buildCategoryTabs(categories: LandingCategory[]): LandingCategory[] {
  const specialtyTabs = categories.filter((category) => category.value !== ALL_CATEGORY_VALUE)
  return [{ label: ALL_CATEGORY_LABEL, value: ALL_CATEGORY_VALUE }, ...specialtyTabs]
}

export const LandingCategories: React.FC<LandingCategoriesProps> = ({
  title,
  description,
  categories,
  items,
  activeFilter,
  onActiveFilterChange,
  featuredIds,
  moreCategoriesLink,
}) => {
  const baseHref = moreCategoriesLink?.href ?? '/listing-comparison'

  const categoryTabs = useMemo<LandingCategory[]>(() => {
    return buildCategoryTabs(categories)
  }, [categories])

  const categoryValueSet = useMemo(() => {
    return new Set(
      categoryTabs.filter((category) => category.value !== ALL_CATEGORY_VALUE).map((category) => category.value),
    )
  }, [categoryTabs])

  const scopedItems = useMemo(() => {
    if (categoryValueSet.size === 0) return items
    return items.filter((item) => item.categories.some((category) => categoryValueSet.has(category)))
  }, [categoryValueSet, items])

  const panelId = 'landing-categories-panel'
  const resolvedFilter = categoryTabs.some((category) => category.value === activeFilter)
    ? activeFilter
    : ALL_CATEGORY_VALUE
  const activeTabId = `landing-categories-tab-${resolvedFilter}`

  const withSpecialtyQuery = (href: string, specialtyId: string | null) => {
    if (!href.startsWith('/')) return href

    const [pathAndQuery, hash] = href.split('#')
    const [pathnameValue = '/', query = ''] = (pathAndQuery ?? '/').split('?')
    const pathname = pathnameValue.length > 0 ? pathnameValue : '/'
    const params = new URLSearchParams(query)

    if (specialtyId) {
      params.set('specialty', specialtyId)
    } else {
      params.delete('specialty')
    }

    const serializedParams = params.toString()
    const next = serializedParams ? `${pathname}?${serializedParams}` : pathname
    return hash ? `${next}#${hash}` : next
  }

  const categoryLabelMap = useMemo(() => {
    return new Map(categoryTabs.map((category) => [category.value, category.label]))
  }, [categoryTabs])

  const categoryIndexMap = useMemo(() => {
    return new Map(
      categoryTabs
        .filter((category) => category.value !== ALL_CATEGORY_VALUE)
        .map((category, index) => [category.value, index]),
    )
  }, [categoryTabs])

  const parkingSlotMap = useMemo(() => {
    const itemIndexByCategory = new Map<string, number>()
    const map = new Map<string, string>()

    for (const item of scopedItems) {
      const primaryCategory = item.categories[0]
      if (!primaryCategory) {
        map.set(item.id, SLOT_HIDDEN)
        continue
      }

      const categoryIndex = categoryIndexMap.get(primaryCategory) ?? 0
      const itemIndex = itemIndexByCategory.get(primaryCategory) ?? 0

      map.set(item.id, resolveCategoryParkingSlot(categoryIndex, itemIndex))
      itemIndexByCategory.set(primaryCategory, itemIndex + 1)
    }

    return map
  }, [categoryIndexMap, scopedItems])

  const curatedItems = useMemo(() => {
    if (!featuredIds?.length) return scopedItems
    return featuredIds
      .map((id) => scopedItems.find((item) => item.id === id))
      .filter((item): item is LandingCategoryItem => Boolean(item))
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
  const hiddenSlot = SLOT_HIDDEN

  return (
    <section className="bg-muted/30 py-20">
      <Container>
        <header className="mb-12 flex flex-col items-center gap-6 border-b border-border/60 pb-6 text-center">
          <SectionHeading
            title={title}
            description={description}
            size="section"
            align="center"
            titleClassName="font-semibold"
          />

          <nav role="tablist" aria-label="Category filters" className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {categoryTabs.map((category) => {
              const isActive = resolvedFilter === category.value
              const tabId = `landing-categories-tab-${category.value}`

              return (
                <button
                  key={category.value}
                  id={tabId}
                  type="button"
                  onClick={() => onActiveFilterChange(category.value)}
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
        </header>

        <div id={panelId} role="tabpanel" aria-labelledby={activeTabId} className="relative mb-12 h-140 w-full">
          {scopedItems.map((item) => {
            const slotIndex = slotMap.get(item.id)
            const hasSlot = slotIndex !== undefined && slotIndex >= 0 && slotIndex < slots.length
            const isVisible = hasSlot
            const slotClass = hasSlot ? slots[slotIndex] : (parkingSlotMap.get(item.id) ?? hiddenSlot)

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
                  <LandingCategoryCard
                    item={item}
                    categories={categoryLabelMap}
                    sizes="(min-width: 1024px) 45vw, (min-width: 768px) 50vw, 100vw"
                    showContent={isVisible}
                  />
                  {isVisible ? (
                    <UiLink
                      href={item.href ?? withSpecialtyQuery(baseHref, item.id)}
                      newTab={item.newTab}
                      className={cn(
                        'absolute inset-0 z-20 block rounded-2xl',
                        'cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                      )}
                    >
                      <span className="sr-only">Explore {item.title}</span>
                    </UiLink>
                  ) : null}
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
      </Container>
    </section>
  )
}

export type LandingCategoriesClientProps = Omit<LandingCategoriesProps, 'activeFilter' | 'onActiveFilterChange'> & {
  defaultActiveFilter?: string
}

export const LandingCategoriesClient: React.FC<LandingCategoriesClientProps> = ({
  defaultActiveFilter,
  categories,
  ...rest
}) => {
  const categoryFilters = useMemo(() => {
    return new Set(buildCategoryTabs(categories).map((category) => category.value))
  }, [categories])

  const preferredDefault =
    typeof defaultActiveFilter === 'string' && categoryFilters.has(defaultActiveFilter)
      ? defaultActiveFilter
      : ALL_CATEGORY_VALUE

  const [activeFilter, setActiveFilter] = useState<string>(preferredDefault)

  useEffect(() => {
    if (!categoryFilters.has(activeFilter)) {
      setActiveFilter(ALL_CATEGORY_VALUE)
    }
  }, [activeFilter, categoryFilters])

  return (
    <LandingCategories
      {...rest}
      categories={categories}
      activeFilter={activeFilter}
      onActiveFilterChange={setActiveFilter}
    />
  )
}

type LandingCategoryCardProps = {
  item?: LandingCategoryItem
  categories: Map<string, string>
  sizes: string
  showContent?: boolean
}

const LandingCategoryCard: React.FC<LandingCategoryCardProps> = ({ item, categories, sizes, showContent = true }) => {
  if (!item) {
    return <div className="h-full w-full rounded-2xl bg-muted/40" aria-hidden="true" />
  }

  const label = categories.get(item.categories[0] ?? '') ?? item.categories[0] ?? 'Category'

  return (
    <div className="group relative h-full w-full overflow-hidden">
      <Image
        src={item.image.src}
        alt={item.image.alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-60" />
      {showContent ? (
        <>
          <div className="absolute bottom-0 left-0 w-full p-6 text-left text-white md:p-8">
            <div className="translate-y-2 transition-all duration-500 group-hover:translate-y-0">
              <p className="text-xs font-bold tracking-widest text-white/80 uppercase">{label}</p>
              <Heading as="h3" size="h5" align="left" className="mt-2 text-2xl font-semibold text-white md:text-2xl">
                {item.title}
              </Heading>
              <p className="mt-2 max-h-0 overflow-hidden text-sm text-white/90 opacity-0 transition-all duration-500 group-hover:max-h-20 group-hover:opacity-100">
                {item.subtitle}
              </p>
            </div>
          </div>
          <div className="absolute top-6 right-6 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg">
              <ArrowRight className="h-4 w-4 -rotate-45" />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
