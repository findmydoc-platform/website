'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Media } from '@/components/molecules/Media'
import { cn } from '@/utilities/ui'

import { DoctorCard } from './DoctorCard'
import type { RelatedDoctorItem } from './types'

export type RelatedDoctorCarouselProps = {
  doctors: RelatedDoctorItem[]
  initialIndex?: number
  title?: string
  className?: string
}

function normalizeIndex(index: number, total: number) {
  if (total <= 0) return 0
  const mod = index % total
  return mod < 0 ? mod + total : mod
}

export function RelatedDoctorCarousel({ doctors, initialIndex = 0, title, className }: RelatedDoctorCarouselProps) {
  const total = doctors.length
  const [activeIndex, setActiveIndex] = React.useState(() => normalizeIndex(initialIndex, total))

  const active = React.useMemo(() => {
    if (!doctors.length) return null
    return doctors[normalizeIndex(activeIndex, doctors.length)]
  }, [activeIndex, doctors])

  const canNavigate = total > 1

  const goTo = (index: number) => {
    setActiveIndex(normalizeIndex(index, total))
  }

  const goPrev = () => {
    goTo(activeIndex - 1)
  }

  const goNext = () => {
    goTo(activeIndex + 1)
  }

  if (!active) return null

  return (
    <div className={cn('w-full', className)}>
      <div className="relative grid grid-cols-12 items-start gap-8 overflow-visible lg:gap-16 xl:gap-20">
        {title ? (
          <div className="relative z-20 col-span-12 lg:col-span-8 lg:col-start-5 lg:row-start-1">
            <h2 className="text-center text-size-72 font-bold text-secondary lg:text-center">{title}</h2>
          </div>
        ) : null}

        <div className="relative z-0 col-span-12 lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="overflow-hidden rounded-2xl shadow-brand-soft">
            <div className="relative aspect-square w-full">
              <Media
                htmlElement={null}
                src={active.heroMedia.src}
                alt={active.heroMedia.alt}
                fill
                imgClassName="object-cover"
                size="(min-width: 1024px) 45vw, 100vw"
                priority={active.heroMedia.priority}
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 col-span-12 lg:col-span-8 lg:col-start-5 lg:row-start-2 lg:pt-8">
          <DoctorCard data={active.card} titleAs="h3" />
        </div>
      </div>

      {canNavigate ? (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2" aria-label="Related doctors">
            {doctors.map((d, idx) => {
              const isActive = idx === normalizeIndex(activeIndex, total)
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-label={`Show doctor ${idx + 1}: ${d.card.name}`}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'rounded-full transition-[background-color,width,height] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden',
                    isActive ? 'size-3.5 bg-primary' : 'size-2.5 bg-primary/30 hover:bg-primary/50',
                  )}
                  onClick={() => goTo(idx)}
                />
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="brandOutlineThick" size="icon" aria-label="Previous doctor" onClick={goPrev}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Button>
            <Button type="button" variant="brandOutlineThick" size="icon" aria-label="Next doctor" onClick={goNext}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
