'use client'

import React, { useMemo, useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { ArrowRight } from 'lucide-react'

import { Container } from '@/components/molecules/Container'
import { UiLink } from '@/components/molecules/Link'
import { cn } from '@/utilities/ui'

type LandingCategory = {
  label: string
  value: string
}

type LandingCategoryItem = {
  id: string
  title: string
  subtitle?: string | null
  categories: string[]
  image: {
    src: ImageProps['src']
    alt: string
  }
}

type LandingCategoriesProps = {
  title?: string
  description?: string
  categories: LandingCategory[]
  items: LandingCategoryItem[]
  featuredIds?: string[]
  moreCategoriesLink?: {
    href: string
    label?: string | null
    newTab?: boolean
  }
}

export const LandingCategories: React.FC<LandingCategoriesProps> = ({
  title = 'Our Categories',
  description = 'Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.',
  categories,
  items,
  featuredIds,
  moreCategoriesLink,
}) => {
  const defaultFilter = categories[0]?.value ?? 'all'
  const [activeFilter, setActiveFilter] = useState<string>(defaultFilter)

  const categoryLabelMap = useMemo(() => {
    return new Map(categories.map((category) => [category.value, category.label]))
  }, [categories])

  const curatedItems = useMemo(() => {
    if (!featuredIds?.length) return items
    return featuredIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is LandingCategoryItem => Boolean(item))
  }, [featuredIds, items])

  const visibleItems = useMemo(() => {
    const matches =
      activeFilter === 'all' ? curatedItems : items.filter((item) => item.categories.includes(activeFilter))

    return matches.slice(0, 4)
  }, [activeFilter, curatedItems, items])

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

  const activeLabel = categoryLabelMap.get(activeFilter)
  const ctaLabel =
    moreCategoriesLink?.label ??
    (activeFilter === 'all' ? 'View all procedures' : `More ${activeLabel ?? 'treatment'} procedures`)
  const ctaHref = moreCategoriesLink?.href ?? '#'

  const slots = [
    'top-0 left-0 h-full w-1/2',
    'top-0 left-1/2 h-1/2 w-1/2',
    'top-1/2 left-1/2 h-1/2 w-1/4',
    'top-1/2 left-3/4 h-1/2 w-1/4',
  ]
  const hiddenSlot = 'top-1/2 left-1/2 h-0 w-0'

  return (
    <section className="bg-muted/30 py-20">
      <Container>
        <header className="border-border/60 mb-12 flex flex-col items-center gap-6 border-b pb-6 text-center">
          <div className="max-w-2xl">
            <h2 className="text-foreground mb-4 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h2>
            <p className="text-foreground/80 text-lg md:text-xl">{description}</p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {categories.map((category) => {
              const isActive = activeFilter === category.value

              return (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setActiveFilter(category.value)}
                  aria-pressed={isActive}
                  className={cn(
                    'relative cursor-pointer text-base font-medium transition-colors md:text-lg',
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {category.label}
                  <span
                    className={cn(
                      'bg-foreground absolute -bottom-2 left-0 h-0.5 transition-all duration-300',
                      isActive ? 'w-full' : 'w-0',
                    )}
                  />
                </button>
              )
            })}
          </nav>
        </header>

        <div className="relative mb-12 h-[560px] w-full">
          {items.map((item) => {
            const slotIndex = slotMap.get(item.id)
            const hasSlot = slotIndex !== undefined && slotIndex >= 0 && slotIndex < slots.length
            const isVisible = hasSlot
            const slotClass = hasSlot ? slots[slotIndex] : hiddenSlot

            return (
              <div
                key={item.id}
                className={cn(
                  'absolute p-3 transition-all duration-700 ease-in-out',
                  slotClass,
                  isVisible ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0',
                  isVisible ? 'z-10' : 'z-0',
                )}
              >
                <div className="border-border/60 bg-muted/40 h-full w-full cursor-pointer overflow-hidden rounded-2xl border shadow-sm">
                  <LandingCategoryCard
                    item={item}
                    categories={categoryLabelMap}
                    sizes="(min-width: 1024px) 45vw, (min-width: 768px) 50vw, 100vw"
                  />
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

type LandingCategoryCardProps = {
  item?: LandingCategoryItem
  categories: Map<string, string>
  sizes: string
}

const LandingCategoryCard: React.FC<LandingCategoryCardProps> = ({ item, categories, sizes }) => {
  if (!item) {
    return <div className="bg-muted/40 h-full w-full rounded-2xl" aria-hidden="true" />
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-60" />
      <div className="absolute bottom-0 left-0 w-full p-6 text-left text-white md:p-8">
        <div className="translate-y-2 transition-all duration-500 group-hover:translate-y-0">
          <p className="text-xs font-bold tracking-widest text-white/80 uppercase">{label}</p>
          <h3 className="md:text2xl mt-2 text-left text-2xl font-semibold text-white">{item.title}</h3>
          <p className="mt-2 max-h-0 overflow-hidden text-sm text-white/90 opacity-0 transition-all duration-500 group-hover:max-h-20 group-hover:opacity-100">
            {item.subtitle}
          </p>
        </div>
      </div>
      <div className="absolute top-6 right-6 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <div className="text-foreground flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg">
          <ArrowRight className="h-4 w-4 -rotate-45" />
        </div>
      </div>
    </div>
  )
}
