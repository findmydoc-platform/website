'use client'

import React, { useLayoutEffect, useMemo, useRef } from 'react'
import Image, { type StaticImageData } from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'
import { cn } from '@/utilities/ui'

gsap.registerPlugin(ScrollTrigger)

type ProcessStepType = {
  step: number
  title: string
  description: string
}

export type LandingProcessCurveConfig = {
  /**
   * SVG path `d` attribute.
   *
   * The coordinates must match the provided `viewBox` coordinate system.
   */
  pathD: string
  /**
   * SVG viewBox string (`minX minY width height`).
   *
   * Keep this aligned with the path coordinates so we can translate SVG points to pixels
   * for positioning the step labels.
   */
  viewBox: string
  /** Tailwind class applied to the <svg>. The path uses `stroke="currentColor"`. */
  curveClassName?: string
  /** Tailwind class applied to each dot (<circle>). */
  dotClassName?: string
  /** Path stroke width in SVG units. */
  strokeWidth?: number
  /** Dot radius in SVG units. */
  dotRadius?: number
  /** Label offset in px relative to the computed dot point. */
  labelOffsetPx: {
    x: number
    y: number
  }
  /**
   * Initial label X-shift (px) used for the reveal animation.
   * Reduced motion forces this to 0.
   */
  labelEnterShiftPx: number
  /**
   * Optional default per-step scroll spacer classes associated with this curve.
   *
   * When provided and no `stepTriggerClassNames` prop is passed, these values are
   * used as the per-step trigger classes. This keeps geometry + scroll pacing
   * co-located in a single curve preset.
   */
  stepTriggerClassNames?: ReadonlyArray<string | undefined>
  /**
   * Optional default progress values (0..1) for labels along the curve.
   *
   * When provided and no `labelProgresses` prop is passed, these values control
   * where labels land along the path. This lets you separate label spacing from
   * dot spacing while keeping both tied to the same curve preset.
   */
  labelProgresses?: ReadonlyArray<number>
}

type LandingProcessProps = {
  steps: ProcessStepType[]
  image?: StaticImageData | string
  imageAlt?: string
  title?: string
  subtitle?: string
  stepImages?: ReadonlyArray<{
    src: StaticImageData | string
    alt: string
  }>
  triggerClassName?: string
  tailClassName?: string
  imageFadeDuration?: number
  /**
   * Optional curve configuration for the SVG timeline.
   *
   * Use this to tune the geometry (`pathD`, `viewBox`), label offsets, and colors.
   */
  curve?: Partial<LandingProcessCurveConfig>
  /**
   * Optional custom step placement values (0..1), aligned by index with `steps`.
   *
   * These values drive both:
   * - where dots + labels land along the path
   * - when each step becomes active while scrolling
   *
   * Values are clamped to [0, 1] and normalized to be non-decreasing.
   */
  stepProgresses?: ReadonlyArray<number>
  /**
   * Optional per-step scroll spacer classes.
   *
   * When provided and the length matches `steps`, each value overrides `triggerClassName`
   * for the corresponding step. Use this to fine-tune viewport-relative gaps between
   * steps so scroll pacing lines up with dot placements.
   */
  stepTriggerClassNames?: ReadonlyArray<string | undefined>
  /**
   * Optional custom label placement values (0..1), aligned by index with `steps`.
   *
   * When provided, these control where labels land along the path. If omitted,
   * labels use `stepProgresses` (or `curve.labelProgresses` if defined).
   */
  labelProgresses?: ReadonlyArray<number>
  /**
   * Optional flag to render the decorative background gradient behind the image.
   *
   * Disabled by default so the layout can be evaluated without the asset.
   */
  showGradientBackground?: boolean
}
/**
 * Default curve configuration for the landing process timeline.
 */
const DEFAULT_CURVE: LandingProcessCurveConfig = {
  pathD: 'M11.33203 10.689453C128.832 237.689 147.332 382.689 11.33203 624.189',
  viewBox: '0 0 109 625',
  curveClassName: 'text-border',
  dotClassName: 'fill-primary',
  strokeWidth: 3,
  dotRadius: 6,
  labelOffsetPx: { x: 48, y: 100 },
  labelEnterShiftPx: 20,

  labelProgresses: [0, 0.29, 0.6, 0.88],
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const resolveStepProgresses = (stepCount: number, provided?: ReadonlyArray<number>): number[] => {
  if (stepCount <= 1) return [0]

  const fallback = Array.from({ length: stepCount }, (_, index) => index / (stepCount - 1))
  const base = provided && provided.length === stepCount ? [...provided] : fallback

  const normalized = base.map((value, index) => {
    const fallbackValue = fallback[index] ?? 0
    const candidate = Number.isFinite(value) ? value : fallbackValue
    return clamp01(candidate)
  })

  for (let index = 1; index < normalized.length; index += 1) {
    const current = normalized[index] ?? 0
    const previous = normalized[index - 1] ?? 0
    normalized[index] = Math.max(current, previous)
  }

  return normalized
}

export const LandingProcess: React.FC<LandingProcessProps> = ({
  steps,
  image = '/images/placeholder-576-968.svg',
  imageAlt = 'Step-by-step process visualization',
  title,
  subtitle,
  stepImages,
  triggerClassName = 'h-[40vh]',
  tailClassName = 'h-[90vh]',
  imageFadeDuration = 0.35,
  curve,
  stepProgresses,
  stepTriggerClassNames,
  labelProgresses,
  showGradientBackground = false,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion()
  const orderedSteps = useMemo(() => steps, [steps])
  const resolvedCurve = useMemo<LandingProcessCurveConfig>(() => {
    const curveLabelOffsetX = curve?.labelOffsetPx?.x
    const curveLabelOffsetY = curve?.labelOffsetPx?.y

    const labelOffsetX = isFiniteNumber(curveLabelOffsetX) ? curveLabelOffsetX : DEFAULT_CURVE.labelOffsetPx.x
    const labelOffsetY = isFiniteNumber(curveLabelOffsetY) ? curveLabelOffsetY : DEFAULT_CURVE.labelOffsetPx.y

    return {
      ...DEFAULT_CURVE,
      ...curve,
      labelOffsetPx: { x: labelOffsetX, y: labelOffsetY },
    }
  }, [curve])

  const resolvedStepProgresses = useMemo(
    () => resolveStepProgresses(orderedSteps.length, stepProgresses),
    [orderedSteps.length, stepProgresses],
  )
  const resolvedLabelProgresses = useMemo(
    () =>
      resolveStepProgresses(orderedSteps.length, labelProgresses ?? resolvedCurve.labelProgresses ?? stepProgresses),
    [labelProgresses, orderedSteps.length, resolvedCurve.labelProgresses, stepProgresses],
  )
  const resolvedStepTriggerClassNames = useMemo(
    () => stepTriggerClassNames ?? resolvedCurve.stepTriggerClassNames,
    [resolvedCurve.stepTriggerClassNames, stepTriggerClassNames],
  )
  const resolvedStepImages = useMemo(
    () =>
      orderedSteps.map((step, index) => ({
        key: `${step.step}-${index}`,
        src: stepImages?.[index]?.src ?? image,
        alt: stepImages?.[index]?.alt ?? imageAlt,
      })),
    [image, imageAlt, orderedSteps, stepImages],
  )

  const rootRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pathRef = useRef<SVGPathElement | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const dotRefs = useRef<Array<SVGCircleElement | null>>([])
  const labelRefs = useRef<Array<HTMLDivElement | null>>([])
  const imageRefs = useRef<Array<HTMLDivElement | null>>([])
  const activeIndexRef = useRef(-1)

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const root = rootRef.current
    const svg = svgRef.current
    const path = pathRef.current
    const scrollArea = scrollAreaRef.current

    if (!root || !svg || !path || !scrollArea || orderedSteps.length === 0) return

    const context = gsap.context(() => {
      const pathLength = path.getTotalLength()
      const labelOffsetX = resolvedCurve.labelOffsetPx.x
      const labelOffsetY = resolvedCurve.labelOffsetPx.y
      const labelShiftX = prefersReducedMotion ? 0 : resolvedCurve.labelEnterShiftPx

      const updatePositions = () => {
        const viewBox = svg.viewBox.baseVal
        const rect = svg.getBoundingClientRect()
        const scaleX = rect.width / viewBox.width
        const scaleY = rect.height / viewBox.height

        const dotDistances = resolvedStepProgresses.map((progress) => progress * pathLength)
        const labelDistances = resolvedLabelProgresses.map((progress) => progress * pathLength)

        dotDistances.forEach((distance, index) => {
          const dot = dotRefs.current[index]
          if (!dot) return

          const point = path.getPointAtLength(distance)
          dot.setAttribute('cx', point.x.toFixed(2))
          dot.setAttribute('cy', point.y.toFixed(2))
        })

        labelDistances.forEach((distance, index) => {
          const label = labelRefs.current[index]
          if (!label) return

          const point = path.getPointAtLength(distance)
          const xPx = (point.x - viewBox.x) * scaleX
          const yPx = (point.y - viewBox.y) * scaleY

          label.style.left = `${(xPx + labelOffsetX).toFixed(2)}px`
          label.style.top = `${(yPx + labelOffsetY).toFixed(2)}px`
        })
      }

      updatePositions()

      const resizeObserver = new ResizeObserver(() => {
        updatePositions()
        ScrollTrigger.refresh()
      })

      resizeObserver.observe(svg)

      gsap.set(path, {
        strokeDasharray: pathLength,
        strokeDashoffset: prefersReducedMotion ? 0 : pathLength,
      })

      dotRefs.current.forEach((dot) => {
        if (!dot) return
        gsap.set(dot, { scale: 0, opacity: 0, transformOrigin: 'center' })
      })

      labelRefs.current.forEach((label) => {
        if (!label) return
        gsap.set(label, { autoAlpha: 0, x: labelShiftX })
      })

      imageRefs.current.forEach((imageNode, index) => {
        if (!imageNode) return
        gsap.set(imageNode, { autoAlpha: index === 0 ? 1 : 0 })
      })

      const revealStep = (index: number) => {
        const dot = dotRefs.current[index]
        const label = labelRefs.current[index]

        if (dot) {
          gsap.to(dot, {
            scale: 1,
            opacity: 1,
            duration: prefersReducedMotion ? 0 : 0.2,
            ease: 'power2.out',
          })
        }

        if (label) {
          gsap.to(label, {
            autoAlpha: 1,
            x: 0,
            duration: prefersReducedMotion ? 0 : 0.4,
            ease: 'power2.out',
          })
        }
      }

      const hideStep = (index: number) => {
        const dot = dotRefs.current[index]
        const label = labelRefs.current[index]

        if (dot) {
          gsap.to(dot, {
            scale: 0,
            opacity: 0,
            duration: prefersReducedMotion ? 0 : 0.2,
            ease: 'power2.out',
          })
        }

        if (label) {
          gsap.to(label, {
            autoAlpha: 0,
            x: labelShiftX,
            duration: prefersReducedMotion ? 0 : 0.3,
            ease: 'power2.out',
          })
        }
      }

      const setActiveImage = (index: number) => {
        imageRefs.current.forEach((imageNode, imageIndex) => {
          if (!imageNode) return
          gsap.to(imageNode, {
            autoAlpha: imageIndex === index ? 1 : 0,
            duration: prefersReducedMotion ? 0 : imageFadeDuration,
            ease: 'power2.out',
          })
        })
      }

      const stepThresholds = resolvedStepProgresses.length > 0 ? resolvedStepProgresses : [0]

      const updateActive = (progress: number) => {
        const nextActive = stepThresholds.reduce((active, threshold, index) => {
          if (progress >= threshold) return index
          return active
        }, 0)

        if (nextActive === activeIndexRef.current) return

        if (nextActive > activeIndexRef.current) {
          for (let index = activeIndexRef.current + 1; index <= nextActive; index += 1) {
            revealStep(index)
          }
        } else {
          for (let index = activeIndexRef.current; index > nextActive; index -= 1) {
            hideStep(index)
          }
        }

        activeIndexRef.current = nextActive
        setActiveImage(Math.max(nextActive, 0))
      }

      const progressTrigger = ScrollTrigger.create({
        trigger: scrollArea,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => updateActive(self.progress),
      })

      updateActive(0)

      if (!prefersReducedMotion) {
        gsap.to(path, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: scrollArea,
            start: 'top top',
            end: 'bottom bottom',
            scrub: true,
          },
        })
      }

      return () => {
        resizeObserver.disconnect()
        progressTrigger.kill()
      }
    }, root)

    return () => context.revert()
  }, [
    imageFadeDuration,
    orderedSteps,
    prefersReducedMotion,
    resolvedCurve,
    resolvedLabelProgresses,
    resolvedStepProgresses,
  ])

  if (orderedSteps.length === 0) return null

  return (
    <section className="bg-white py-20">
      <Container>
        <SectionHeading className="mb-16" title={title} description={subtitle} size="section" align="center" />

        <div className="relative" ref={rootRef}>
          <div className="sticky top-24">
            <div className="grid gap-12 lg:grid-cols-2">
              <div className="relative z-10">
                {showGradientBackground && (
                  <div className={cn('pointer-events-none absolute z-0 hidden opacity-70 lg:block', 'top-50 left-110')}>
                    <Image
                      src="/images/our-process-gradient.png"
                      alt=""
                      aria-hidden="true"
                      width={1088}
                      height={1685}
                      priority={false}
                      // External-constraint: scale a designer-provided raster gradient to match the curved timeline.
                      className="h-auto scale-[2.58]"
                    />
                  </div>
                )}

                <div className="relative z-10 aspect-576/968 max-h-160 w-full overflow-hidden rounded-3xl bg-background md:max-h-192">
                  {resolvedStepImages.map((stepImage, index) => (
                    <div
                      key={stepImage.key}
                      ref={(node) => {
                        imageRefs.current[index] = node
                      }}
                      className="absolute inset-0 bg-background"
                    >
                      <Image src={stepImage.src} alt={stepImage.alt} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative z-10">
                <div
                  className={cn(
                    'relative',
                    // External-constraint: align the SVG curve height to the design composition.
                    'min-h-160',
                  )}
                >
                  <svg
                    ref={svgRef}
                    className={cn(
                      'absolute top-20 left-0 h-full w-24',
                      resolvedCurve.curveClassName ?? DEFAULT_CURVE.curveClassName,
                    )}
                    viewBox={resolvedCurve.viewBox}
                    fill="none"
                    preserveAspectRatio="xMinYMin meet"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      ref={pathRef}
                      d={resolvedCurve.pathD}
                      stroke="currentColor"
                      strokeWidth={resolvedCurve.strokeWidth ?? DEFAULT_CURVE.strokeWidth}
                      vectorEffect="non-scaling-stroke"
                    />
                    {orderedSteps.map((step, index) => (
                      <circle
                        key={`${step.step}-${index}`}
                        ref={(node) => {
                          dotRefs.current[index] = node
                        }}
                        r={resolvedCurve.dotRadius ?? DEFAULT_CURVE.dotRadius}
                        className={resolvedCurve.dotClassName ?? DEFAULT_CURVE.dotClassName}
                      />
                    ))}
                  </svg>

                  {orderedSteps.map((step, index) => (
                    <div
                      key={`${step.step}-label-${index}`}
                      ref={(node) => {
                        labelRefs.current[index] = node
                      }}
                      className="absolute max-w-md -translate-y-1/2 opacity-0"
                      aria-hidden="true"
                    >
                      <div className="flex flex-row items-start gap-4">
                        <span className="w-14 shrink-0 text-5xl leading-none font-bold text-foreground tabular-nums">
                          {step.step}.
                        </span>
                        <div className="flex min-w-0 flex-col pt-1">
                          <h3 className="mb-2 text-left text-xl leading-snug font-bold text-foreground">
                            {step.title}
                          </h3>
                          <p className="text-md leading-relaxed text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="pt-8" ref={scrollAreaRef}>
            {/* External-constraint: scrollytelling spacers must be viewport-relative for step pacing. */}
            {orderedSteps.map((step, index) => (
              <div
                key={`${step.step}-trigger-${index}`}
                className={resolvedStepTriggerClassNames?.[index] ?? triggerClassName}
              />
            ))}
            <div className={tailClassName} />
          </div>
        </div>

        <ol className="sr-only">
          {orderedSteps.map((step) => (
            <li key={step.step}>
              {step.step}. {step.title}. {step.description}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
