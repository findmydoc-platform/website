'use client'

import React, { useId, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'
import { cn } from '@/utilities/ui'

gsap.registerPlugin(ScrollTrigger)

export type PatientTrustOrbitStatement = {
  label: string
  description: string
}

export type PatientTrustOrbitProps = {
  eyebrow?: string
  title: string
  description: string
  points: string[]
  coreLabel: string
  how: string[]
  outcomes: PatientTrustOrbitStatement[]
  className?: string
}

const TrustOrbitArtwork: React.FC<{
  coreLabel: string
  how: string[]
  outcomes: PatientTrustOrbitStatement[]
}> = ({ coreLabel, how, outcomes }) => {
  return (
    <div
      className="grid min-h-[540px] gap-10 overflow-hidden py-8 sm:min-h-[520px] sm:grid-cols-[minmax(0,0.58fr)_minmax(240px,0.42fr)] sm:items-center sm:gap-4 sm:py-0 xl:gap-6"
      data-patient-trust-reveal=""
    >
      <div className="relative min-h-[350px] sm:h-[520px] sm:min-h-0">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          fill="none"
          viewBox="0 0 420 520"
        >
          <path
            d="M236 224 C286 152 344 118 416 94"
            className="stroke-accent/30"
            data-patient-trust-path=""
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M244 260 C300 252 352 258 416 260"
            className="stroke-accent/25"
            data-patient-trust-path=""
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M236 296 C286 368 344 402 416 426"
            className="stroke-accent/28"
            data-patient-trust-path=""
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <circle cx="210" cy="260" r="62" className="stroke-accent/35" strokeWidth="2" />
          <circle cx="210" cy="260" r="104" className="stroke-secondary/10" strokeWidth="2" />
          <circle cx="210" cy="260" r="142" className="stroke-secondary/10" strokeWidth="1.5" />
        </svg>

        <div
          className="absolute top-1/2 left-1/2 z-10 flex size-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent/45 bg-site-section text-center text-base leading-tight font-bold text-secondary shadow-[0_18px_70px_-46px_rgba(7,0,76,0.5)] before:absolute before:inset-3 before:rounded-full before:border before:border-accent/25 after:absolute after:inset-7 after:rounded-full after:bg-accent sm:size-40"
          data-patient-trust-node=""
        >
          <span className="relative z-10 max-w-24">{coreLabel}</span>
        </div>

        <ol className="absolute bottom-8 left-1/2 z-10 grid w-full max-w-[330px] -translate-x-1/2 grid-cols-3 gap-2 text-center text-xs font-semibold tracking-[0.08em] text-secondary/70 uppercase sm:bottom-14 sm:w-[330px]">
          {how.slice(0, 3).map((step) => (
            <li key={step} className="border-t border-secondary/15 pt-3" data-patient-trust-node="">
              {step}
            </li>
          ))}
        </ol>
      </div>

      <ul className="relative z-10 space-y-5 sm:flex sm:flex-col sm:justify-center sm:gap-9 sm:space-y-0">
        {outcomes.slice(0, 3).map((outcome) => (
          <li key={outcome.label} className="border-l-2 border-accent/75 pl-4" data-patient-trust-node="">
            <p className="text-base font-bold text-secondary sm:text-lg">{outcome.label}</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-secondary/72">{outcome.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const PatientTrustOrbit: React.FC<PatientTrustOrbitProps> = ({
  className,
  coreLabel,
  description,
  eyebrow,
  how,
  outcomes,
  points,
  title,
}) => {
  const titleId = useId()
  const rootRef = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    if (prefersReducedMotion) {
      root.dataset.patientTrustMotion = 'reduced'
      root.dataset.patientTrustState = 'visible'
      return
    }

    const revealTargets = Array.from(root.querySelectorAll<HTMLElement>('[data-patient-trust-reveal]'))
    const pathTargets = Array.from(root.querySelectorAll<SVGPathElement>('[data-patient-trust-path]'))
    const nodeTargets = Array.from(root.querySelectorAll<HTMLElement | SVGCircleElement>('[data-patient-trust-node]'))

    let hasPlayed = false
    let trigger: ScrollTrigger | null = null
    const context = gsap.context(() => {
      root.dataset.patientTrustMotion = 'animated'
      root.dataset.patientTrustState = 'hidden'

      gsap.set(revealTargets, { opacity: 0, y: 22, willChange: 'opacity, transform' })
      gsap.set(nodeTargets, { opacity: 0, scale: 0.96, transformOrigin: 'center' })
      pathTargets.forEach((path) => {
        const length = path.getTotalLength()
        gsap.set(path, {
          strokeDasharray: length,
          strokeDashoffset: length,
        })
      })

      const timeline = gsap.timeline({
        paused: true,
        defaults: { ease: 'power2.out' },
        onStart: () => {
          root.dataset.patientTrustState = 'animating'
        },
        onComplete: () => {
          root.dataset.patientTrustState = 'visible'
          gsap.set([...revealTargets, ...nodeTargets], { clearProps: 'opacity,transform,willChange' })
        },
      })

      timeline
        .to(revealTargets, {
          duration: 0.66,
          opacity: 1,
          stagger: 0.1,
          y: 0,
        })
        .to(
          pathTargets,
          {
            duration: 0.82,
            stagger: 0.08,
            strokeDashoffset: 0,
          },
          '-=0.22',
        )
        .to(
          nodeTargets,
          {
            duration: 0.58,
            opacity: 1,
            scale: 1,
            stagger: 0.055,
          },
          '-=0.56',
        )

      const play = () => {
        if (hasPlayed) return
        hasPlayed = true
        trigger?.kill()
        timeline.play(0)
      }

      trigger = ScrollTrigger.create({
        trigger: root,
        start: 'top 76%',
        once: true,
        onEnter: play,
      })

      if (root.getBoundingClientRect().top <= window.innerHeight * 0.76) {
        play()
      }
    }, root)

    return () => {
      trigger?.kill()
      context.revert()
    }
  }, [prefersReducedMotion])

  return (
    <section
      ref={rootRef}
      aria-labelledby={titleId}
      className={cn('bg-site-canvas py-16 text-secondary sm:py-20 lg:py-24', className)}
      data-patient-trust-motion="static"
      data-patient-trust-orbit=""
      data-patient-trust-state="visible"
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.76fr)_2px_minmax(0,1.34fr)] lg:gap-16">
          <div className="max-w-xl self-center" data-patient-trust-reveal="">
            {eyebrow ? (
              <p className="mb-4 text-sm font-semibold tracking-[0.12em] text-accent uppercase">{eyebrow}</p>
            ) : null}
            <Heading id={titleId} as="h2" align="left" size="h3" className="max-w-lg text-secondary">
              {title}
            </Heading>
            <p className="mt-6 text-base leading-8 text-secondary/76 sm:text-lg sm:leading-9">{description}</p>
            <ul className="mt-8 space-y-4 text-base leading-7 text-secondary/82">
              {points.slice(0, 3).map((point) => (
                <li key={point} className="flex gap-3" data-patient-trust-reveal="">
                  <span className="mt-1.5 h-5 w-0.5 shrink-0 rounded-full bg-accent/80" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div aria-hidden="true" className="hidden w-[2px] self-stretch bg-secondary/20 lg:block" />

          <TrustOrbitArtwork coreLabel={coreLabel} how={how} outcomes={outcomes} />
        </div>
      </Container>
    </section>
  )
}
