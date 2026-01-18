// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
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
  const toMock = vi.fn((target: { current: number }, vars: GsapToVars): TweenLike => {
    target.current = vars.current
    vars.onUpdate?.()
    vars.onComplete?.()
    return { kill: () => undefined }
  })

  return { toMock }
})

vi.mock('gsap', () => ({
  default: {
    to: gsapMocks.toMock,
  },
}))

import { Award, Shield, Users } from 'lucide-react'

import { TrustQualitySection } from '@/components/organisms/TrustQualitySection'

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

describe('TrustQualitySection', () => {
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
  })

  it('supports section-level locale for numeric stats', async () => {
    render(
      <TrustQualitySection
        title="Trust proven quality"
        subtitle="We only work with certified clinics"
        numberLocale="de-DE"
        stats={[
          { value: 1200, suffix: '+', label: 'Treatment types', Icon: Users },
          { value: 98, suffix: '%', label: 'Satisfaction rate', Icon: Award },
          { valueText: 'TÜV', label: 'Verified platform', Icon: Shield },
        ]}
        badges={['TÜV Süd certified']}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Trust proven quality' })).toBeInTheDocument()
    expect(screen.getByText('We only work with certified clinics')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('1.200+').length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('98%').length).toBeGreaterThan(0)
    expect(screen.getByText('TÜV')).toBeInTheDocument()
    expect(screen.getByText('TÜV Süd certified')).toBeInTheDocument()
  })

  it('allows per-stat locale overrides', async () => {
    render(
      <TrustQualitySection
        title="Trust proven quality"
        numberLocale="de-DE"
        stats={[{ value: 1200, suffix: '+', label: 'Treatment types', Icon: Users, locale: 'en-US' }]}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByText('1,200+').length).toBeGreaterThan(0)
    })
  })
})
