'use client'

import { useEffect, useRef } from 'react'
import { useMotionValueEvent, useReducedMotion, useSpring } from 'motion/react'

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
  const prefersReducedMotion = useReducedMotion()
  const x = useSpring(0, { stiffness: 120, damping: 24 })
  const y = useSpring(0, { stiffness: 120, damping: 24 })

  const rootRef = useRef<HTMLElement | null>(null)
  const mediaRef = useRef<HTMLElement | null>(null)

  useMotionValueEvent(x, 'change', (value) => {
    const media = mediaRef.current
    if (!media) return

    media.style.setProperty('--fmd-section-bg-x', `${value.toFixed(2)}px`)
  })

  useMotionValueEvent(y, 'change', (value) => {
    const media = mediaRef.current
    if (!media) return

    media.style.setProperty('--fmd-section-bg-y', `${value.toFixed(2)}px`)
  })

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`[data-section-background-root="${targetId}"]`)
    const media = document.querySelector<HTMLElement>(`[data-section-background-media="${targetId}"]`)

    rootRef.current = root
    mediaRef.current = media

    if (!root || !media) return

    const setImmediateVars = (xPx: number, yPx: number, nextScale: number) => {
      media.style.setProperty('--fmd-section-bg-x', `${xPx.toFixed(2)}px`)
      media.style.setProperty('--fmd-section-bg-y', `${yPx.toFixed(2)}px`)
      media.style.setProperty('--fmd-section-bg-scale', `${nextScale}`)
    }

    if (prefersReducedMotion) {
      setImmediateVars(0, 0, 1)
      return
    }

    media.style.setProperty('--fmd-section-bg-scale', `${scale}`)

    // Ensure a known baseline on mount.
    x.set(0)
    y.set(0)
    setImmediateVars(0, 0, scale)

    const updateScrollTarget = () => {
      const rect = root.getBoundingClientRect()
      const viewportH = window.innerHeight || 0

      if (!viewportH) return

      const center = rect.top + rect.height / 2
      const normalized = center / viewportH
      const delta = clamp(0.5 - normalized, -0.5, 0.5)

      y.set(delta * rangePx)
    }

    const supportsFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches ?? false

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect()
      const normalizedX = clamp((event.clientX - rect.left) / rect.width, 0, 1)
      const normalizedY = clamp((event.clientY - rect.top) / rect.height, 0, 1)

      x.set((normalizedX - 0.5) * rangePx)
      y.set((normalizedY - 0.5) * rangePx)
    }

    const onPointerLeave = () => {
      x.set(0)
      y.set(0)
    }

    const wantsScroll = mode === 'scroll' || mode === 'both'
    const wantsPointer = (mode === 'pointer' || mode === 'both') && supportsFinePointer

    let scrollRafId: number | null = null

    const scheduleScrollUpdate = () => {
      if (scrollRafId !== null) return
      scrollRafId = window.requestAnimationFrame(() => {
        scrollRafId = null
        updateScrollTarget()
      })
    }

    if (wantsScroll) {
      updateScrollTarget()
      window.addEventListener('scroll', scheduleScrollUpdate, { passive: true })
      window.addEventListener('resize', scheduleScrollUpdate)
    }

    if (wantsPointer) {
      root.addEventListener('pointermove', onPointerMove)
      root.addEventListener('pointerleave', onPointerLeave)
    }

    return () => {
      if (scrollRafId !== null) window.cancelAnimationFrame(scrollRafId)

      if (wantsScroll) {
        window.removeEventListener('scroll', scheduleScrollUpdate)
        window.removeEventListener('resize', scheduleScrollUpdate)
      }

      if (wantsPointer) {
        root.removeEventListener('pointermove', onPointerMove)
        root.removeEventListener('pointerleave', onPointerLeave)
      }

      rootRef.current = null
      mediaRef.current = null
    }
  }, [mode, prefersReducedMotion, rangePx, scale, targetId, x, y])

  return null
}
