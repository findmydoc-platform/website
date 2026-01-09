'use client'

import React, { useLayoutEffect, useMemo, useRef } from 'react'
import Image, { type StaticImageData } from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { Container } from '@/components/molecules/Container'
import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'
import { cn } from '@/utilities/ui'

type ProcessStepType = {
  step: number
  title: string
  description: string
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
}

const CURVE_PATH = 'M1.33203 0.689453C118.832 227.689 137.332 372.689 1.33203 614.189'
const CURVE_VIEWBOX = '0 0 99 615'
const LABEL_OFFSET_PX = 48
const LABEL_SHIFT_PX = 20

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
}) => {
  const prefersReducedMotion = usePrefersReducedMotion()
  const orderedSteps = useMemo(() => steps, [steps])
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
      const labelOffsetX = LABEL_OFFSET_PX
      const labelShiftX = prefersReducedMotion ? 0 : LABEL_SHIFT_PX

      const updatePositions = () => {
        const viewBox = svg.viewBox.baseVal
        const rect = svg.getBoundingClientRect()
        const scaleX = rect.width / viewBox.width
        const scaleY = rect.height / viewBox.height

        const stepDistances =
          orderedSteps.length > 1
            ? orderedSteps.map((_, index) => (pathLength * index) / (orderedSteps.length - 1))
            : [0]

        stepDistances.forEach((distance, index) => {
          const dot = dotRefs.current[index]
          const label = labelRefs.current[index]
          if (!dot || !label) return

          const point = path.getPointAtLength(distance)
          dot.setAttribute('cx', point.x.toFixed(2))
          dot.setAttribute('cy', point.y.toFixed(2))

          const xPx = (point.x - viewBox.x) * scaleX
          const yPx = (point.y - viewBox.y) * scaleY

          label.style.left = `${(xPx + labelOffsetX).toFixed(2)}px`
          label.style.top = `${yPx.toFixed(2)}px`
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

      const stepThresholds =
        orderedSteps.length > 1
          ? orderedSteps.map((_, index) => index / (orderedSteps.length - 1))
          : [0]

      const updateActive = (progress: number) => {
        const nextActive = stepThresholds.reduce((active, threshold, index) => {
          if (progress >= threshold) return index
          return active
        }, -1)

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
  }, [imageFadeDuration, orderedSteps, prefersReducedMotion])

  if (orderedSteps.length === 0) return null

  return (
    <section className="bg-white py-20">
      <Container>
        {(title || subtitle) && (
          <div className="mb-16 text-center">
            {title && <h2 className="text-foreground mb-6 text-5xl font-bold">{title}</h2>}
            {subtitle && <p className="text-foreground/80 mx-auto max-w-2xl text-xl">{subtitle}</p>}
          </div>
        )}

        <div className="relative" ref={rootRef}>
          <div className="sticky top-24">
            <div className="grid gap-12 lg:grid-cols-2">
              <div className="relative z-10">
                <div
                  className={cn(
                    'pointer-events-none absolute z-0 hidden opacity-70 lg:block',
                    'top-50 left-110',
                  )}
                >
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

                <div className="bg-background relative z-10 aspect-576/968 max-h-160 w-full overflow-hidden rounded-3xl md:max-h-192">
                  {resolvedStepImages.map((stepImage, index) => (
                    <div
                      key={stepImage.key}
                      ref={(node) => {
                        imageRefs.current[index] = node
                      }}
                      className="bg-background absolute inset-0"
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
                    'min-h-[640px]',
                  )}
                >
                  <svg
                    ref={svgRef}
                    className="text-border absolute left-0 top-0 h-full w-24"
                    viewBox={CURVE_VIEWBOX}
                    fill="none"
                    preserveAspectRatio="xMinYMin meet"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      ref={pathRef}
                      d={CURVE_PATH}
                      stroke="currentColor"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                    />
                    {orderedSteps.map((step, index) => (
                      <circle
                        key={`${step.step}-${index}`}
                        ref={(node) => {
                          dotRefs.current[index] = node
                        }}
                        r="6"
                        className="fill-primary"
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
                    >
                      <div className="flex flex-row items-start gap-4">
                        <span className="w-14 shrink-0 tabular-nums text-5xl font-bold leading-none text-foreground">
                          {step.step}.
                        </span>
                        <div className="min-w-0 flex flex-col pt-1">
                          <h3 className="mb-2 text-left text-xl font-bold leading-snug text-foreground">
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
                className={triggerClassName}
              />
            ))}
            <div className={tailClassName} />
          </div>
        </div>
      </Container>
    </section>
  )
}
