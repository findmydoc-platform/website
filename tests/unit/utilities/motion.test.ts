// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

import { usePrefersReducedMotion } from '@/utilities/use-prefers-reduced-motion'

const PreferenceStatus = () => {
  const prefersReducedMotion = usePrefersReducedMotion()
  return React.createElement('span', null, prefersReducedMotion ? 'reduced' : 'full')
}

describe('usePrefersReducedMotion', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('should report reduced motion when the media query matches', async () => {
    render(React.createElement(PreferenceStatus))

    await waitFor(() => {
      expect(screen.getByText('reduced')).toBeInTheDocument()
    })
  })

  it('should report full motion when the media query does not match', async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? false : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia

    render(React.createElement(PreferenceStatus))

    await waitFor(() => {
      expect(screen.getByText('full')).toBeInTheDocument()
    })
  })
})
