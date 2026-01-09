'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'

export type SectionBackgroundParallaxMode = 'scroll' | 'pointer' | 'both'

export type SectionBackgroundParallaxProps = {
  targetId: string
  mode?: SectionBackgroundParallaxMode
  /** Max translation in px (per axis). Keep subtle. */
  rangePx?: number
  /** Slight scale to prevent edge gaps when translating. */
  scale?: number
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const SectionBackgroundParallax = ({
  targetId,
  mode = 'scroll',
  rangePx = 40,
  scale = 1.06,
}: SectionBackgroundParallaxProps) => {
  const prefersReducedMotion = usePrefersReducedMotion()

  const rootRef = useRef<HTMLElement | null>(null)
  const mediaRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const root = document.querySelector<HTMLElement>(`[data-section-background-root="${targetId}"]`)
    const media = document.querySelector<HTMLElement>(`[data-section-background-media="${targetId}"]`)

    rootRef.current = root
    mediaRef.current = media

    if (!root || !media) return

    const setImmediateVars = (xPx: number, yPx: number, nextScale: number) => {
      gsap.set(media, {
        '--fmd-section-bg-x': `${xPx.toFixed(2)}px`,
        '--fmd-section-bg-y': `${yPx.toFixed(2)}px`,
        '--fmd-section-bg-scale': `${nextScale}`,
      })
    }

    if (prefersReducedMotion) {
      setImmediateVars(0, 0, 1)
      return
    }

    gsap.set(media, { '--fmd-section-bg-scale': `${scale}` })

    // Ensure a known baseline on mount.
    setImmediateVars(0, 0, scale)
    let scrollTrigger: ScrollTrigger | null = null

    const updateScrollTarget = () => {
      const rect = root.getBoundingClientRect()
      const viewportH = window.innerHeight || 0

      if (!viewportH) return

      const center = rect.top + rect.height / 2
      const normalized = center / viewportH
      const delta = clamp(0.5 - normalized, -0.5, 0.5)

      gsap.set(media, { '--fmd-section-bg-y': `${(delta * rangePx).toFixed(2)}px` })
    }

    const supportsFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches ?? false

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect()
      const normalizedX = clamp((event.clientX - rect.left) / rect.width, 0, 1)
      const normalizedY = clamp((event.clientY - rect.top) / rect.height, 0, 1)

      gsap.to(media, {
        '--fmd-section-bg-x': `${((normalizedX - 0.5) * rangePx).toFixed(2)}px`,
        '--fmd-section-bg-y': `${((normalizedY - 0.5) * rangePx).toFixed(2)}px`,
        duration: 0.35,
        ease: 'power2.out',
      })
    }

    const onPointerLeave = () => {
      gsap.to(media, {
        '--fmd-section-bg-x': '0px',
        '--fmd-section-bg-y': '0px',
        duration: 0.4,
        ease: 'power2.out',
      })
    }

    const wantsScroll = mode === 'scroll' || mode === 'both'
    const wantsPointer = (mode === 'pointer' || mode === 'both') && supportsFinePointer

    if (wantsScroll) {
      updateScrollTarget()
      scrollTrigger = ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: updateScrollTarget,
      })
    }

    if (wantsPointer) {
      root.addEventListener('pointermove', onPointerMove)
      root.addEventListener('pointerleave', onPointerLeave)
    }

    return () => {
      if (wantsScroll) {
        scrollTrigger?.kill()
      }

      if (wantsPointer) {
        root.removeEventListener('pointermove', onPointerMove)
        root.removeEventListener('pointerleave', onPointerLeave)
      }

      rootRef.current = null
      mediaRef.current = null
    }
  }, [mode, prefersReducedMotion, rangePx, scale, targetId])

  return null
}
