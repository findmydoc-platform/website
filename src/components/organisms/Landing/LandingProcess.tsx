'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image, { type StaticImageData } from 'next/image'
import scrollama, { type DecimalType } from 'scrollama'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'

import { Container } from '@/components/molecules/Container'
import { ProcessStep } from '@/components/molecules/ProcessStep'
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

  scrollOffset?: DecimalType
  triggerClassName?: string
  tailClassName?: string

  stepMotion?: {
    enterDuration?: number
    exitDuration?: number
    xOffset?: number
  }

  imageFadeDuration?: number
}

const TOTAL_STEPS = 4

// Offsets to match the concave curve (dots sit on the curve on lg+).
const STEP_OFFSET_CLASSES = ['lg:ml-px', 'lg:ml-20.5', 'lg:ml-21.5', 'lg:ml-1.5']

export const LandingProcess: React.FC<LandingProcessProps> = ({
  steps,
  image = '/images/placeholder-576-968.png',
  imageAlt = 'Process visual',
  title,
  subtitle,
  stepImages,
  scrollOffset = 0.6,
  triggerClassName = 'h-[40vh]',
  tailClassName = 'h-[90vh]',
  stepMotion,
  imageFadeDuration = 0.35,
}) => {
  const prefersReducedMotion = useReducedMotion()
  const [activeStep, setActiveStep] = useState(0)

  const orderedSteps = useMemo(() => steps.slice(0, TOTAL_STEPS), [steps])

  const resolvedStepMotion = useMemo(
    () => ({
      enterDuration: stepMotion?.enterDuration ?? 0.8,
      exitDuration: stepMotion?.exitDuration ?? 0.5,
      xOffset: stepMotion?.xOffset ?? 50,
    }),
    [stepMotion?.enterDuration, stepMotion?.exitDuration, stepMotion?.xOffset],
  )

  const resolvedImageFadeDuration = prefersReducedMotion ? 0 : imageFadeDuration

  const activeImage = useMemo(() => {
    const img = stepImages?.[activeStep]
    return {
      src: img?.src ?? image,
      alt: img?.alt ?? imageAlt,
      key: stepImages ? String(activeStep) : 'static',
    }
  }, [activeStep, image, imageAlt, stepImages])

  // Slower slide-in from right
  const stepVariants: Variants = useMemo(
    () => ({
      hidden: {
        opacity: 0,
        x: prefersReducedMotion ? 0 : resolvedStepMotion.xOffset,
        transition: {
          duration: resolvedStepMotion.exitDuration,
          ease: 'easeOut',
        },
      },
      visible: {
        opacity: 1,
        x: 0,
        transition: {
          duration: resolvedStepMotion.enterDuration,
          ease: 'easeOut',
        },
      },
    }),
    [
      prefersReducedMotion,
      resolvedStepMotion.enterDuration,
      resolvedStepMotion.exitDuration,
      resolvedStepMotion.xOffset,
    ],
  )

  useEffect(() => {
    const scroller = scrollama()
    const handleStepEnter = ({ index }: { index: number }) => {
      setActiveStep(index)
    }

    scroller
      .setup({
        step: '[data-landing-process-trigger]',
        offset: scrollOffset,
      })
      .onStepEnter(handleStepEnter)

    const handleResize = () => scroller.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      scroller.destroy()
    }
  }, [scrollOffset])

  if (orderedSteps.length < TOTAL_STEPS) return null

  return (
    <section className="bg-white py-20">
      <Container>
        {(title || subtitle) && (
          <div className="mb-16 text-center">
            {title && <h2 className="mb-6 text-5xl font-bold text-foreground">{title}</h2>}
            {subtitle && <p className="mx-auto max-w-2xl text-xl text-foreground/80">{subtitle}</p>}
          </div>
        )}

        <div className="relative">
          {/*
            Shared sticky wrapper ensures the image and steps release together.
            Scroll triggers below control activation + overall sticky scroll distance.
          */}
          <div className="sticky top-24">
            <div className="grid gap-12 lg:grid-cols-2">
              <div className="relative z-10">
                {/*
                  Decorative blurred blob should move with the sticky image.
                  We use a static public asset (already blurred) for performance during scroll.
                  The positioning uses arbitrary Tailwind values to align the designer asset with the curve.
                */}
                <div
                  className={cn(
                    'pointer-events-none absolute hidden lg:block z-0 opacity-70',
                    // External-constraint: pixel-fit a designer-provided raster blob behind the curve.
                    // Tip: prefer `translate-x-*` nudges over changing `left-*` if you want to move it without touching scale.
                    'left-110 top-50',
                  )}
                >
                  <Image
                    src="/images/our-process-gradient.png"
                    alt=""
                    aria-hidden="true"
                    width={1088}
                    height={1685}
                    priority={false}
                    // External-constraint: scale the raster asset without introducing runtime SVG filters.
                    className="h-auto scale-[2.58]"
                  />
                </div>

                {/*
                  Aspect ratio is based on the 576x968 asset.
                  We cap max-height (8pt increments) so this mood image stays visually consistent and doesn't dominate on wide screens.
                */}
                <div className="relative z-10 aspect-576/968 w-full max-h-160 overflow-hidden rounded-3xl bg-background md:max-h-192">
                  <AnimatePresence mode="wait" initial={false}>
                    {activeImage.src ? (
                      <motion.div
                        key={activeImage.key}
                        className="absolute inset-0 bg-background"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: resolvedImageFadeDuration, ease: 'easeOut' }}
                      >
                        <Image src={activeImage.src} alt={activeImage.alt} fill className="object-cover" />
                      </motion.div>
                    ) : (
                      <div aria-hidden="true" className="absolute inset-0 bg-muted" />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="relative z-10">
                <div className="relative lg:pt-12 lg:pb-12">
                  {/* Concave curve (bulge right) behind the dots */}
                  <svg
                    className="absolute left-2 top-18 hidden w-24 lg:block text-border"
                    width="99"
                    height="615"
                    viewBox="0 0 99 615"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1.33203 0.689453C118.832 227.689 137.332 372.689 1.33203 614.189"
                      stroke="#F2F2F7"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>

                  <div className="relative flex flex-col gap-22">
                    {orderedSteps.map((step, index) => {
                      const isRevealed = index <= activeStep
                      const isActive = index === activeStep

                      return (
                        <div key={step.step} className={cn('relative', STEP_OFFSET_CLASSES[index])}>
                          <ProcessStep
                            step={step.step}
                            title={step.title}
                            description={step.description}
                            isActive={isActive}
                            isRevealed={isRevealed}
                            variants={stepVariants}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/*
            Scroll triggers create the scroll distance for the section.
            We use vh units here because it's a scrollytelling constraint (no design token fits multi-viewport steps).
          */}
          <div aria-hidden="true" className="pt-8">
            {orderedSteps.map((step) => (
              <div key={step.step} data-landing-process-trigger className={triggerClassName} />
            ))}
            <div className={tailClassName} />
          </div>
        </div>
      </Container>
    </section>
  )
}
