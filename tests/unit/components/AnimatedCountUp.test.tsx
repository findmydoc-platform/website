// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type TweenLike = { kill: () => void }

type GsapToVars = {
  current: number
  duration?: number
  ease?: string
  onUpdate?: () => void
  onComplete?: () => void
}

const gsapMocks = vi.hoisted(() => {
  const killMock = vi.fn<() => void>()
  const toMock = vi.fn((target: { current: number }, vars: GsapToVars): TweenLike => {
    target.current = vars.current
    vars.onUpdate?.()
    vars.onComplete?.()
    return { kill: killMock }
  })

  return { killMock, toMock }
})

vi.mock('gsap', () => ({
  default: {
    to: gsapMocks.toMock,
  },
}))

import { AnimatedCountUp } from '@/components/organisms/TrustQualitySection/AnimatedCountUp'

const createMatchMedia = (prefersReducedMotion: boolean) => {
  return ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

describe('AnimatedCountUp', () => {
  const originalMatchMedia = window.matchMedia
  const originalIntersectionObserver = window.IntersectionObserver

  beforeEach(() => {
    window.matchMedia = createMatchMedia(false)
    window.IntersectionObserver = undefined as unknown as typeof window.IntersectionObserver
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    window.IntersectionObserver = originalIntersectionObserver
    gsapMocks.toMock.mockClear()
    gsapMocks.killMock.mockClear()
  })

  it('formats with the provided locale', async () => {
    const { container } = render(
      <AnimatedCountUp value={1200} suffix="+" locale="de-DE" className="count" durationMs={300} />,
    )

    const valueEl = container.querySelector<HTMLSpanElement>('.count')
    expect(valueEl).toBeTruthy()

    await waitFor(() => {
      expect(valueEl).toHaveTextContent('1.200+')
    })

    expect(gsapMocks.toMock).toHaveBeenCalledTimes(1)
  })

  it('skips animation when reduced motion is preferred', async () => {
    window.matchMedia = createMatchMedia(true)

    const { container } = render(
      <AnimatedCountUp value={500} suffix="+" locale="en-US" className="count" durationMs={300} />,
    )

    const valueEl = container.querySelector<HTMLSpanElement>('.count')
    expect(valueEl).toBeTruthy()

    await waitFor(() => {
      expect(valueEl).toHaveTextContent('500+')
    })

    expect(gsapMocks.toMock).not.toHaveBeenCalled()
  })
})
