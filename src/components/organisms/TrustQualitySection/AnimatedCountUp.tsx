'use client'

import * as React from 'react'

import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

export type AnimatedCountUpProps = {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  locale?: string
  durationMs?: number
  startValue?: number
  className?: string
  threshold?: number
}

export function AnimatedCountUp({
  value,
  prefix,
  suffix,
  decimals = 0,
  locale = 'en-US',
  durationMs = 1200,
  startValue = 0,
  className,
  threshold = 0.35,
}: AnimatedCountUpProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const spanRef = React.useRef<HTMLSpanElement | null>(null)
  const hasAnimatedRef = React.useRef(false)

  const formatter = React.useMemo(() => {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }, [decimals, locale])

  const formatValue = React.useCallback(
    (rawValue: number) => {
      return `${prefix ?? ''}${formatter.format(rawValue)}${suffix ?? ''}`
    },
    [formatter, prefix, suffix],
  )

  React.useEffect(() => {
    const span = spanRef.current
    if (!span) return

    if (prefersReducedMotion) {
      span.textContent = formatValue(value)
      return
    }

    span.textContent = formatValue(startValue)

    let rafId = 0
    let startedAtMs: number | null = null

    const tick = (nowMs: number) => {
      if (startedAtMs === null) startedAtMs = nowMs

      const elapsedMs = nowMs - startedAtMs
      const progress = Math.min(elapsedMs / durationMs, 1)
      const eased = easeOutCubic(progress)

      const current = startValue + (value - startValue) * eased
      span.textContent = formatValue(current)

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick)
      } else {
        hasAnimatedRef.current = true
        span.textContent = formatValue(value)
      }
    }

    const start = () => {
      if (hasAnimatedRef.current) return
      rafId = window.requestAnimationFrame(tick)
    }

    if (typeof window.IntersectionObserver !== 'function') {
      start()
      return () => {
        if (rafId) window.cancelAnimationFrame(rafId)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect()
            start()
            break
          }
        }
      },
      { threshold },
    )

    observer.observe(span)

    return () => {
      observer.disconnect()
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [durationMs, formatValue, prefersReducedMotion, startValue, threshold, value])

  return (
    <React.Fragment>
      <span ref={spanRef} className={className} aria-hidden={true} />
      <span className="sr-only">{formatValue(value)}</span>
    </React.Fragment>
  )
}
