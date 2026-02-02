'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { flushSync } from 'react-dom'

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

const BASE_ANIMATION_DURATION_S = 0.5
const DURATION_PER_SLIDE_S = 0.1
const MAX_ADDITIONAL_DURATION_S = 0.5

// Sliding window around the active slide.
// We keep this intentionally small to avoid rendering many duplicates for small testimonial counts.
// For large jumps (e.g. clicking a far-away dot), we skip the scroll animation and jump instantly.
const WINDOW_OFFSETS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const

type WindowOffset = (typeof WINDOW_OFFSETS)[number]

const getWrappedIndex = (baseIndex: number, offset: number, length: number): number => {
  if (length === 0) return 0

  const wrapped = (baseIndex + offset) % length

  return wrapped < 0 ? wrapped + length : wrapped
}

type CarouselContextValue = {
  testimonials: LandingTestimonial[]
  activeIndex: number
  highlightedIndex: number
  length: number
  windowItems: Array<{ offset: WindowOffset; index: number; testimonial: LandingTestimonial }>
  trackRef: React.RefObject<HTMLDivElement | null>
  centerSlideRef: React.RefObject<HTMLElement | null>
  goToIndex: (index: number) => void
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
  const [activeIndex, setActiveIndex] = useState(0)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const length = testimonials.length
  const trackRef = useRef<HTMLDivElement | null>(null)
  const centerSlideRef = useRef<HTMLElement | null>(null)

  const stepPxRef = useRef<number | null>(null)
  const isAnimatingRef = useRef(false)
  const tweenRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    return () => {
      tweenRef.current?.kill()
      tweenRef.current = null
      isAnimatingRef.current = false
    }
  }, [])

  const windowItems = useMemo(() => {
    if (length === 0) return []

    return WINDOW_OFFSETS.map((offset) => {
      const index = getWrappedIndex(activeIndex, offset, length)
      return {
        offset,
        index,
        testimonial: testimonials[index]!,
      }
    })
  }, [activeIndex, length, testimonials])

  useLayoutEffect(() => {
    const trackEl = trackRef.current
    const centerEl = centerSlideRef.current

    if (!trackEl || !centerEl) return

    const computeStep = () => {
      const width = centerEl.getBoundingClientRect().width
      const computedStyle = window.getComputedStyle(trackEl)
      const gapRaw = computedStyle.columnGap || computedStyle.gap || '0px'
      const gap = Number.parseFloat(gapRaw) || 0
      stepPxRef.current = width + gap
    }

    computeStep()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(computeStep)
    observer.observe(trackEl)
    observer.observe(centerEl)

    return () => {
      observer.disconnect()
    }
  }, [activeIndex, length])

  const canNavigate = length > 1

  const animateScroll = useCallback(
    (delta: number) => {
      if (!canNavigate) return
      if (delta === 0) return

      if (isAnimatingRef.current) return
      isAnimatingRef.current = true

      const trackEl = trackRef.current
      const stepPx = (() => {
        if (stepPxRef.current) return stepPxRef.current
        if (!trackEl) return null
        const centerEl = centerSlideRef.current
        if (!centerEl) return null

        const width = centerEl.getBoundingClientRect().width
        const computedStyle = window.getComputedStyle(trackEl)
        const gapRaw = computedStyle.columnGap || computedStyle.gap || '0px'
        const gap = Number.parseFloat(gapRaw) || 0
        const nextStep = width + gap
        stepPxRef.current = nextStep
        return nextStep
      })()

      const nextIndex = getWrappedIndex(activeIndex, delta, length)

      if (!trackEl || !stepPx || prefersReducedMotion) {
        setActiveIndex(nextIndex)
        setHighlightedIndex(nextIndex)
        isAnimatingRef.current = false
        return
      }

      const duration =
        BASE_ANIMATION_DURATION_S + Math.min(Math.abs(delta) * DURATION_PER_SLIDE_S, MAX_ADDITIONAL_DURATION_S)

      // Immediately remove highlight from current slide when movement starts
      setHighlightedIndex(-1)

      tweenRef.current?.kill()
      tweenRef.current = gsap.to(trackEl, {
        x: -delta * stepPx,
        duration,
        ease: 'power2.out',
        onComplete: () => {
          tweenRef.current = null
          flushSync(() => {
            setActiveIndex(nextIndex)
          })
          gsap.set(trackEl, { x: 0 })

          // Allow subsequent navigation immediately after the structural reset.
          // Highlighting can follow on the next frame.
          isAnimatingRef.current = false

          // Trigger fade-in of the new card after the structural reset.
          // We wait a frame so the new card first renders unhighlighted, then highlighted.
          // This avoids a flash where the incoming card appears highlighted before the reset.
          requestAnimationFrame(() => {
            setHighlightedIndex(nextIndex)
          })
        },
      })
    },
    [activeIndex, canNavigate, length, prefersReducedMotion],
  )

  const goToIndex = useCallback(
    (index: number) => {
      if (!canNavigate) return
      if (index < 0 || index >= length) return
      if (index === activeIndex) return

      // Strict linear navigation based on visual dot position
      // Clicking a dot to the right (larger index) moves right (content moves left)
      // Clicking a dot to the left (smaller index) moves left (content moves right)
      const delta = index - activeIndex

      const maxAnimatedDelta = 4
      if (Math.abs(delta) > maxAnimatedDelta) {
        tweenRef.current?.kill()
        tweenRef.current = null
        isAnimatingRef.current = false
        setActiveIndex(index)
        setHighlightedIndex(index)
        return
      }

      animateScroll(delta)
    },
    [activeIndex, canNavigate, length, animateScroll],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!canNavigate) return

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          goToIndex(getWrappedIndex(activeIndex, -1, length))
          break
        case 'ArrowRight':
          event.preventDefault()
          goToIndex(getWrappedIndex(activeIndex, 1, length))
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
    [activeIndex, canNavigate, goToIndex, length],
  )

  if (length === 0) return null

  return (
    <CarouselContext.Provider
      value={{
        testimonials,
        activeIndex,
        highlightedIndex,
        length,
        windowItems,
        trackRef,
        centerSlideRef,
        goToIndex,
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
  const { windowItems, trackRef, centerSlideRef, highlightedIndex } = useCarouselContext()

  return (
    // Full-bleed wrapper so the edge cards clip at the viewport boundary.
    <div
      className={cn(
        'relative left-1/2 flex w-screen -translate-x-1/2 justify-center overflow-hidden',
        // On small screens, keep things compact.
        'px-4 lg:px-0',
        // External constraint: CSS mask gradients are not expressible via Tailwind theme tokens.
        // We use arbitrary properties instead of inline styles to comply with repo guidelines.
        'mask-[linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]',
        '[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]',
        className,
      )}
    >
      <div ref={trackRef} className={cn('flex w-fit gap-6 py-4 will-change-transform')}>
        {windowItems.map(({ offset, index, testimonial }) => {
          // A slide is visually "center" if it is the one currently in the middle (offset === 0)
          // AND it matches the highlightedIndex.
          // Since windowItems are based on `activeIndex`, the item with offset === 0 is ALWAYS `activeIndex`.
          // We cross-check with `highlightedIndex` to allow turning off the highlight during animation.
          const isHighlighted = index === highlightedIndex && offset === 0

          return (
            <article
              key={`${index}-${offset}`}
              ref={offset === 0 ? centerSlideRef : undefined}
              className={cn(
                'flex shrink-0 flex-col justify-between rounded-3xl p-6 shadow-sm transition-all ease-out',
                // Fade-in (becoming highlighted) is faster (300ms) than fade-out (700ms).
                // This asymmetry makes the card's arrival feel snappier, while the slower fade-out
                // creates a smoother, less jarring transition as it leaves focus.
                isHighlighted ? 'duration-300' : 'duration-700',
                // Card widths are tuned to show 3 full cards and 2 edge peeks on desktop.
                'w-11/12 sm:w-96 lg:w-80 xl:w-96',
                isHighlighted ? 'bg-primary text-white' : 'border border-border bg-white',
              )}
            >
              <p
                className={cn(
                  'mb-8 text-lg leading-relaxed font-medium transition-colors',
                  isHighlighted ? 'text-white duration-300' : 'text-muted-foreground duration-700',
                )}
              >
                &quot;{testimonial.quote}&quot;
              </p>

              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-full sm:h-20 sm:w-20">
                  <Image src={testimonial.image} alt={testimonial.author} fill className="object-cover" />
                </div>
                <div>
                  <Heading
                    as="h4"
                    align="left"
                    size="h6"
                    className={cn(
                      'text-lg font-bold transition-colors sm:text-xl',
                      isHighlighted ? 'text-white duration-300' : 'text-foreground duration-700',
                    )}
                  >
                    {testimonial.author}
                  </Heading>
                  <p
                    className={cn(
                      'text-xs font-semibold transition-colors sm:text-sm',
                      isHighlighted ? 'text-white/80 duration-300' : 'text-foreground duration-700',
                    )}
                  >
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </article>
          )
        })}
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
              'cursor-pointer rounded-full transition-all duration-300',
              isActive ? 'h-3 w-3 border-2 border-primary bg-white' : 'h-2 w-2 bg-border',
            )}
            aria-label={`Go to slide ${index + 1} of ${testimonials.length}`}
            aria-current={isActive ? 'true' : undefined}
          />
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
