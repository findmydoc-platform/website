'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import useEmblaCarousel, { type EmblaViewportRefType, type UseEmblaCarouselType } from 'embla-carousel-react'
import Image from 'next/image'

import { Heading } from '@/components/atoms/Heading'
import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'
import { cn } from '@/utilities/ui'

import type { LandingTestimonial } from './LandingTestimonials.types'

type LandingTestimonialsCarouselRootProps = {
  testimonials: LandingTestimonial[]
  className?: string
  /** Accessible label for the carousel region. */
  ariaLabel?: string
  /** Optional id of the section heading for aria-labelledby wiring. */
  labelledById?: string
  children: React.ReactNode
}

type LandingTestimonialsCarouselClientProps = {
  testimonials: LandingTestimonial[]
  className?: string
  /** Accessible label for the carousel region. */
  ariaLabel?: string
  /** Optional id of the section heading for aria-labelledby wiring. */
  labelledById?: string
}

type CarouselApi = UseEmblaCarouselType[1]
type EmblaOptions = Parameters<typeof useEmblaCarousel>[0]

type CarouselSlide = {
  snapIndex: number
  index: number
  testimonial: LandingTestimonial
}

const MIN_RENDERED_SLIDES = 9
const EMBLA_DURATION = 12
const DESKTOP_STAGE_MIN_WIDTH = 1024

const getSlideAlignment = (viewSize: number, snapSize: number) => {
  if (viewSize < DESKTOP_STAGE_MIN_WIDTH) return 0

  return Math.max(0, (viewSize - snapSize) / 2)
}

const getRepeatCount = (length: number) => {
  if (length <= 1) return 1

  return Math.max(1, Math.ceil(MIN_RENDERED_SLIDES / length))
}

const getTestimonialImageProps = (testimonial: LandingTestimonial) => {
  if (typeof testimonial.image === 'string') {
    return {
      src: testimonial.image,
      alt: testimonial.author,
      sizes: '(min-width: 640px) 80px, 64px',
    }
  }

  return {
    src: testimonial.image.src,
    alt: testimonial.image.alt ?? testimonial.author,
    sizes: testimonial.image.sizes ?? '(min-width: 640px) 80px, 64px',
    quality: testimonial.image.quality,
    objectPosition: testimonial.image.objectPosition,
  }
}

type CarouselContextValue = {
  testimonials: LandingTestimonial[]
  activeIndex: number
  activeSnapIndex: number
  isTransitioning: boolean
  length: number
  slides: CarouselSlide[]
  viewportRef: EmblaViewportRefType
  goToIndex: (index: number) => void
  goToNext: () => void
  goToPrevious: () => void
  canNavigate: boolean
}

const CarouselContext = createContext<CarouselContextValue | null>(null)

const useCarouselContext = (): CarouselContextValue => {
  const ctx = useContext(CarouselContext)
  if (!ctx) {
    throw new Error('LandingTestimonialsCarousel components must be used within <LandingTestimonialsCarousel.Root>.')
  }
  return ctx
}

const Root: React.FC<LandingTestimonialsCarouselRootProps> = ({
  testimonials,
  className,
  ariaLabel = 'Testimonials carousel',
  labelledById,
  children,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion()
  const length = testimonials.length
  const canNavigate = length > 1
  const repeatCount = getRepeatCount(length)
  const initialSnapIndex = canNavigate ? Math.floor(repeatCount / 2) * length : 0

  const slides = useMemo<CarouselSlide[]>(() => {
    if (length === 0) return []

    return Array.from({ length: repeatCount * length }, (_, snapIndex) => {
      const index = snapIndex % length

      return {
        snapIndex,
        index,
        testimonial: testimonials[index]!,
      }
    })
  }, [length, repeatCount, testimonials])

  const emblaOptions = useMemo<EmblaOptions>(
    () => ({
      align: getSlideAlignment,
      containScroll: false,
      duration: prefersReducedMotion ? 0 : EMBLA_DURATION,
      loop: false,
      skipSnaps: false,
      slidesToScroll: 1,
      startIndex: initialSnapIndex,
      watchDrag: canNavigate,
    }),
    [canNavigate, initialSnapIndex, prefersReducedMotion],
  )
  const [viewportRef, emblaApi] = useEmblaCarousel(emblaOptions)
  const [activeSnapIndex, setActiveSnapIndex] = useState(initialSnapIndex)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    setActiveSnapIndex(initialSnapIndex)
    setIsTransitioning(false)
  }, [initialSnapIndex])

  const syncVisibleSnap = useCallback((api: CarouselApi) => {
    if (!api) return

    const selectedSnap = api.selectedScrollSnap()
    const selectedSlide = api.slideNodes()[selectedSnap]
    const rootNode = api.rootNode()

    if (!selectedSlide) return

    const rootRect = rootNode.getBoundingClientRect()
    const slideRect = selectedSlide.getBoundingClientRect()
    const isFullyVisible = slideRect.left >= rootRect.left - 2 && slideRect.right <= rootRect.right + 2

    if (!isFullyVisible) return

    setActiveSnapIndex(selectedSnap)
    setIsTransitioning(false)
  }, [])

  const handleSelect = useCallback(
    (api: CarouselApi) => {
      if (!api) return
      if (api.selectedScrollSnap() === activeSnapIndex) return

      setIsTransitioning(true)
      window.requestAnimationFrame(() => syncVisibleSnap(api))
    },
    [activeSnapIndex, syncVisibleSnap],
  )

  const syncSettledSnap = useCallback(
    (api: CarouselApi) => {
      if (!api) return

      syncVisibleSnap(api)
    },
    [syncVisibleSnap],
  )

  useEffect(() => {
    if (!emblaApi) return

    syncSettledSnap(emblaApi)
    emblaApi.on('select', handleSelect)
    emblaApi.on('reInit', syncSettledSnap)
    emblaApi.on('scroll', syncVisibleSnap)
    emblaApi.on('settle', syncSettledSnap)

    return () => {
      emblaApi.off('select', handleSelect)
      emblaApi.off('reInit', syncSettledSnap)
      emblaApi.off('scroll', syncVisibleSnap)
      emblaApi.off('settle', syncSettledSnap)
    }
  }, [emblaApi, handleSelect, syncSettledSnap, syncVisibleSnap])

  const activeIndex = slides[activeSnapIndex]?.index ?? 0

  const getNearestSnapIndex = useCallback(
    (index: number) => {
      if (slides.length === 0) return 0

      const selectedSnap = emblaApi?.selectedScrollSnap() ?? activeSnapIndex
      let nearestSnapIndex = -1
      let nearestDistance = Number.POSITIVE_INFINITY

      slides.forEach((slide) => {
        if (slide.index !== index) return

        const distance = Math.abs(slide.snapIndex - selectedSnap)

        if (distance < nearestDistance) {
          nearestSnapIndex = slide.snapIndex
          nearestDistance = distance
        }
      })

      return nearestSnapIndex >= 0 ? nearestSnapIndex : index
    },
    [activeSnapIndex, emblaApi, slides],
  )

  const goToIndex = useCallback(
    (index: number) => {
      if (!canNavigate) return
      if (!emblaApi) return
      if (index < 0 || index >= length) return

      const targetSnapIndex = getNearestSnapIndex(index)

      emblaApi.scrollTo(targetSnapIndex, prefersReducedMotion)

      if (prefersReducedMotion) {
        setActiveSnapIndex(targetSnapIndex)
        setIsTransitioning(false)
      }
    },
    [canNavigate, emblaApi, getNearestSnapIndex, length, prefersReducedMotion],
  )

  const goToNext = useCallback(() => {
    if (!canNavigate) return
    if (!emblaApi) return

    if (emblaApi.canScrollNext()) {
      emblaApi.scrollNext(prefersReducedMotion)
      return
    }

    goToIndex((activeIndex + 1) % length)
  }, [activeIndex, canNavigate, emblaApi, goToIndex, length, prefersReducedMotion])

  const goToPrevious = useCallback(() => {
    if (!canNavigate) return
    if (!emblaApi) return

    if (emblaApi.canScrollPrev()) {
      emblaApi.scrollPrev(prefersReducedMotion)
      return
    }

    goToIndex((activeIndex - 1 + length) % length)
  }, [activeIndex, canNavigate, emblaApi, goToIndex, length, prefersReducedMotion])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!canNavigate) return

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          goToPrevious()
          break
        case 'ArrowRight':
          event.preventDefault()
          goToNext()
          break
        case 'Home':
          event.preventDefault()
          goToIndex(0)
          break
        case 'End':
          event.preventDefault()
          goToIndex(length - 1)
          break
        default:
          break
      }
    },
    [canNavigate, goToIndex, goToNext, goToPrevious, length],
  )

  if (length === 0) return null

  return (
    <CarouselContext.Provider
      value={{
        testimonials,
        activeIndex,
        activeSnapIndex,
        isTransitioning,
        length,
        slides,
        viewportRef,
        goToIndex,
        goToNext,
        goToPrevious,
        canNavigate,
      }}
    >
      <div
        className={cn(
          'relative rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
          className,
        )}
        role="region"
        aria-roledescription="carousel"
        aria-label={labelledById ? undefined : ariaLabel}
        aria-labelledby={labelledById}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

type TrackProps = {
  className?: string
}

const Track: React.FC<TrackProps> = ({ className }) => {
  const { activeSnapIndex, isTransitioning, length, slides, viewportRef } = useCarouselContext()

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-xl overflow-hidden md:max-w-none lg:relative lg:left-1/2 lg:w-screen lg:-translate-x-1/2',
        'lg:mask-[linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]',
        'lg:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]',
        className,
      )}
    >
      <div ref={viewportRef} className="overflow-hidden" data-testid="landing-testimonials-viewport">
        <div
          className="flex touch-pan-y gap-5 py-4 will-change-transform sm:gap-6 lg:gap-8"
          data-testid="landing-testimonials-track"
        >
          {slides.map(({ snapIndex, index, testimonial }) => {
            const isSelected = !isTransitioning && snapIndex === activeSnapIndex
            const image = getTestimonialImageProps(testimonial)

            return (
              <div
                key={`${snapIndex}-${index}`}
                className="min-w-0 shrink-0 grow-0 basis-full lg:basis-80 xl:basis-96"
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${index + 1} of ${length}`}
                aria-hidden={!isSelected}
              >
                <article
                  className={cn(
                    'relative flex h-full min-h-[19rem] flex-col justify-between overflow-hidden rounded-3xl border bg-white p-6 text-center shadow-sm transition-[border-color,box-shadow,transform] duration-300 ease-out md:min-h-[21rem] md:text-left',
                    isSelected ? 'border-primary/40 shadow-lg shadow-primary/10' : 'border-border',
                  )}
                  data-slide-index={index}
                  data-slide-selected={isSelected ? 'true' : 'false'}
                  data-snap-index={snapIndex}
                  data-testid="landing-testimonials-slide"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-x-0 top-0 h-1 bg-primary transition-opacity duration-300',
                      isSelected ? 'opacity-100' : 'opacity-0',
                    )}
                    data-testid="landing-testimonials-active-accent"
                  />
                  <p className="mb-8 text-base leading-7 font-medium text-muted-foreground transition-colors duration-300 sm:text-lg sm:leading-relaxed">
                    &quot;{testimonial.quote}&quot;
                  </p>

                  <div className="flex flex-col items-center gap-3 md:flex-row md:gap-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full sm:h-20 sm:w-20">
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes={image.sizes}
                        quality={image.quality}
                        className="object-cover"
                        style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
                      />
                    </div>
                    <div>
                      <Heading
                        as="h4"
                        align="center"
                        size="h6"
                        className="text-lg font-bold text-foreground transition-colors duration-300 md:text-left md:text-xl"
                      >
                        {testimonial.author}
                      </Heading>
                      <p className="text-sm font-medium text-muted-foreground transition-colors duration-300">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type DotsProps = {
  className?: string
}

const Dots: React.FC<DotsProps> = ({ className }) => {
  const { testimonials, activeIndex, canNavigate, goToIndex } = useCarouselContext()

  if (!canNavigate) return null

  return (
    <div className={cn('mt-8 flex items-center justify-center gap-3', className)}>
      {testimonials.map((_, index) => {
        const isActive = index === activeIndex

        return (
          <button
            key={index}
            type="button"
            onClick={() => goToIndex(index)}
            className={cn(
              'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
              isActive ? 'text-primary' : 'text-border hover:text-primary/50',
            )}
            aria-label={`Go to slide ${index + 1} of ${testimonials.length}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <span
              aria-hidden="true"
              className={cn(
                'block rounded-full transition-all duration-300',
                isActive ? 'h-3 w-3 border-2 border-primary bg-white' : 'h-2 w-2 bg-current',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

export const LandingTestimonialsCarousel = {
  Root,
  Track,
  Dots,
}

export const LandingTestimonialsCarouselClient: React.FC<LandingTestimonialsCarouselClientProps> = ({
  testimonials,
  className,
  ariaLabel,
  labelledById,
}) => {
  return (
    <Root testimonials={testimonials} className={className} ariaLabel={ariaLabel} labelledById={labelledById}>
      <Track />
      <Dots />
    </Root>
  )
}
