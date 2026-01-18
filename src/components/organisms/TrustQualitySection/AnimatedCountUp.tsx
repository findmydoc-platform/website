'use client'

import * as React from 'react'
import gsap from 'gsap'

import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'

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
  const tweenRef = React.useRef<gsap.core.Tween | null>(null)

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

    const setText = (rawValue: number) => {
      span.textContent = formatValue(rawValue)
    }

    if (prefersReducedMotion) {
      hasAnimatedRef.current = true
      setText(value)
      return
    }

    const start = () => {
      if (hasAnimatedRef.current) return

      tweenRef.current?.kill()

      const durationSec = Math.max(durationMs, 0) / 1000
      const state = { current: startValue }

      setText(startValue)

      if (durationSec === 0) {
        hasAnimatedRef.current = true
        setText(value)
        return
      }

      tweenRef.current = gsap.to(state, {
        current: value,
        duration: durationSec,
        ease: 'power3.out',
        onUpdate: () => {
          setText(state.current)
        },
        onComplete: () => {
          hasAnimatedRef.current = true
          setText(value)
        },
      })
    }

    if (typeof window.IntersectionObserver !== 'function') {
      start()
      return () => {
        tweenRef.current?.kill()
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
      tweenRef.current?.kill()
    }
  }, [durationMs, formatValue, prefersReducedMotion, startValue, threshold, value])

  return (
    <React.Fragment>
      <span ref={spanRef} className={className} aria-hidden={true} />
      <span className="sr-only">{formatValue(value)}</span>
    </React.Fragment>
  )
}
