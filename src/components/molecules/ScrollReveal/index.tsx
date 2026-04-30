'use client'

import React, { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'
import { cn } from '@/utilities/ui'

gsap.registerPlugin(ScrollTrigger)

const REVEAL_PRESETS = {
  section: {
    duration: 0.7,
    distancePx: 24,
    stagger: 0.12,
  },
  surface: {
    duration: 0.64,
    distancePx: 18,
    stagger: 0.1,
  },
} as const

export type ScrollRevealProps = {
  children: React.ReactNode
  className?: string
  preset?: keyof typeof REVEAL_PRESETS
  start?: string
  staggerSelector?: string
}

const DEFAULT_START = 'top 76%'

const resolveViewportThreshold = (start: string): number => {
  const match = /^top\s+(\d+(?:\.\d+)?)%$/i.exec(start.trim())
  if (!match) return 0.76

  const value = Number.parseFloat(match[1] ?? '76')
  if (!Number.isFinite(value)) return 0.76

  return Math.min(1, Math.max(0, value / 100))
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  className,
  preset = 'section',
  start = DEFAULT_START,
  staggerSelector,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const playRevealRef = useRef<(() => void) | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    root.dataset.scrollRevealPreset = preset

    if (prefersReducedMotion) {
      root.dataset.scrollRevealMode = 'reduced'
      root.dataset.scrollRevealState = 'visible'
      playRevealRef.current = null
      return
    }

    const presetConfig = REVEAL_PRESETS[preset]
    const staggerTargets = staggerSelector
      ? Array.from(root.querySelectorAll<HTMLElement>(staggerSelector)).filter((node) => node.isConnected)
      : []
    const animationTargets = staggerTargets.length > 0 ? staggerTargets : [root]

    let hasPlayed = false
    const context = gsap.context(() => {
      root.dataset.scrollRevealMode = staggerTargets.length > 0 ? 'stagger' : 'single'
      root.dataset.scrollRevealState = 'hidden'

      gsap.set(animationTargets, {
        opacity: 0,
        y: presetConfig.distancePx,
        willChange: 'opacity, transform',
      })

      const tween = gsap.to(animationTargets, {
        duration: presetConfig.duration,
        ease: 'power2.out',
        opacity: 1,
        paused: true,
        stagger: animationTargets.length > 1 ? presetConfig.stagger : 0,
        y: 0,
        onStart: () => {
          root.dataset.scrollRevealState = 'animating'
        },
        onComplete: () => {
          root.dataset.scrollRevealState = 'visible'
          gsap.set(animationTargets, {
            clearProps: 'opacity,transform,willChange',
          })
        },
      })

      let trigger: ScrollTrigger | null = null
      const playReveal = () => {
        if (hasPlayed) return
        hasPlayed = true
        trigger?.kill()
        tween.play(0)
      }

      playRevealRef.current = playReveal
      trigger = ScrollTrigger.create({
        trigger: root,
        start,
        once: true,
        onEnter: playReveal,
      })

      // Reveal immediately when the section already starts inside the trigger range.
      if (root.getBoundingClientRect().top <= window.innerHeight * resolveViewportThreshold(start)) {
        playReveal()
      }
    }, root)

    return () => {
      playRevealRef.current = null
      context.revert()
    }
  }, [prefersReducedMotion, preset, staggerSelector, start])

  const handleFocusCapture = () => {
    playRevealRef.current?.()
  }

  return (
    <div
      ref={rootRef}
      className={cn(className)}
      data-scroll-reveal-root=""
      data-scroll-reveal-state="visible"
      onFocusCapture={handleFocusCapture}
    >
      {children}
    </div>
  )
}

export default ScrollReveal
