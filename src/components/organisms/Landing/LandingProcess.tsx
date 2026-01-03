'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image, { type StaticImageData } from 'next/image'
import scrollama from 'scrollama'
import { motion, useReducedMotion } from 'motion/react'

import { Container } from '@/components/molecules/Container'
import ph576x968 from '@/stories/assets/placeholder-576-968.png'
import { createRevealVariants, revealTransition } from '@/utilities/motion'
import { cn } from '@/utilities/ui'

type ProcessStep = {
  step: number
  title: string
  description: string
}

type LandingProcessProps = {
  steps: ProcessStep[]
  image?: StaticImageData | string
  imageAlt?: string
}

const TOTAL_STEPS = 4

export const LandingProcess: React.FC<LandingProcessProps> = ({
  steps,
  image = ph576x968,
  imageAlt = 'Process visual',
}) => {
  const prefersReducedMotion = useReducedMotion()
  const [activeStep, setActiveStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)

  const orderedSteps = useMemo(() => steps.slice(0, TOTAL_STEPS), [steps])
  const revealVariants = useMemo(() => createRevealVariants(prefersReducedMotion), [prefersReducedMotion])

  useEffect(() => {
    const scroller = scrollama()
    const handleStepEnter = ({ index }: { index: number }) => {
      setActiveStep(index)
      setMaxStep((prev) => Math.max(prev, index))
    }

    scroller
      .setup({
        step: '[data-landing-process-step]',
        offset: 0.6,
      })
      .onStepEnter(handleStepEnter)

    const handleResize = () => scroller.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      scroller.destroy()
    }
  }, [])

  if (orderedSteps.length < TOTAL_STEPS) return null

  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-16 text-center">
          <h2 className="mb-6 text-5xl font-bold text-foreground">Our Process</h2>
          <p className="mx-auto max-w-2xl text-xl text-foreground/80">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
        </div>

        {/* Using 220vh ensures four step reveals; no theme token exists for multi-viewport heights. */}
        <div className="grid gap-12 lg:grid-cols-2 min-h-[220vh]">
          <div className="relative">
            <div className="sticky top-24">
              {/*
                Aspect ratio is based on the 576x968 asset.
                We cap max-height (8pt increments) so this mood image stays visually consistent and doesn't dominate on wide screens.
              */}
              <div className="relative aspect-576/968 w-full max-h-160 overflow-hidden rounded-3xl md:max-h-192">
                <Image src={image} alt={imageAlt} fill className="object-cover" />
              </div>
            </div>
          </div>

          <div className="relative flex flex-col justify-center gap-12 py-8">
            <div className="absolute left-2 top-4 bottom-4 hidden w-px bg-border lg:block" />

            {orderedSteps.map((step, index) => {
              const isRevealed = index <= maxStep
              const isActive = index === activeStep

              return (
                <motion.div
                  key={step.step}
                  data-landing-process-step
                  className="relative pl-10"
                  initial={false}
                  variants={revealVariants}
                  animate={isRevealed ? 'visible' : 'hidden'}
                  transition={revealTransition}
                >
                  <span
                    className={cn(
                      'absolute left-0 top-3 h-3 w-3 rounded-full border border-border bg-background',
                      isActive && 'border-primary bg-primary'
                    )}
                  />
                  {/* TODO(landing-process): extract step markup into a molecule to separate layout from animation. */}
                  <div className="flex flex-row items-start gap-4">
                    <span
                      className={cn(
                        'text-5xl font-bold leading-none text-foreground',
                        !isActive && isRevealed && 'text-foreground/80'
                      )}
                    >
                      {step.step}.
                    </span>
                    <div className="flex flex-col pt-1">
                      <h3
                        className={cn(
                          'mb-2 text-xl font-bold text-foreground',
                          !isActive && isRevealed && 'text-foreground/90'
                        )}
                      >
                        {step.title}
                      </h3>
                      <p className="text-lg text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </Container>
    </section>
  )
}
