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

import { BadgeCheck, FileText, MapPin, Users } from 'lucide-react'

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
        title="A clearer way to compare clinics"
        subtitle="We make clinic profiles easier to compare by showing key treatment, location, and price fields in one place."
        numberLocale="de-DE"
        stats={[
          { value: 1200, suffix: '+', label: 'verified clinics', Icon: Users },
          { value: 48, label: 'treatment types', Icon: BadgeCheck },
          { value: 12, label: 'cities', Icon: MapPin },
          { value: 86, label: 'price entries', Icon: FileText },
        ]}
        badges={['Verified clinic profiles', 'Price fields where available']}
      />,
    )

    expect(screen.getByRole('heading', { name: 'A clearer way to compare clinics' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'We make clinic profiles easier to compare by showing key treatment, location, and price fields in one place.',
      ),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('1.200+').length).toBeGreaterThan(0)
    })

    expect(screen.getByRole('list', { name: 'Comparison details' })).toBeInTheDocument()
    expect(screen.getAllByText('86').length).toBeGreaterThan(0)
    expect(screen.getByText('Price fields where available')).toBeInTheDocument()
  })

  it('allows per-stat locale overrides', async () => {
    render(
      <TrustQualitySection
        title="A clearer way to compare clinics"
        numberLocale="de-DE"
        stats={[{ value: 1200, suffix: '+', label: 'verified clinics', Icon: Users, locale: 'en-US' }]}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByText('1,200+').length).toBeGreaterThan(0)
    })
  })
})
