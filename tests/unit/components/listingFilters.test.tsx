// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ListingFilters } from '@/components/organisms/Listing/ListingFilters'

describe('ListingFilters', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {
        return undefined
      }
      unobserve() {
        return undefined
      }
      disconnect() {
        return undefined
      }
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('emits the current price range when an uncontrolled rating selection changes', () => {
    const onValueChange = vi.fn()

    render(
      <ListingFilters.Root defaultValue={{ priceRange: [1000, 4000], rating: null }} onValueChange={onValueChange}>
        <ListingFilters.Rating />
      </ListingFilters.Root>,
    )

    fireEvent.click(screen.getByRole('button', { name: '4+ ★' }))

    expect(onValueChange).toHaveBeenLastCalledWith({
      priceRange: [1000, 4000],
      rating: 4,
    })
    expect(screen.getByRole('button', { name: '4+ ★' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps controlled values intact when emitting rating changes', () => {
    const onValueChange = vi.fn()

    render(
      <ListingFilters.Root value={{ priceRange: [2000, 8000], rating: 4.5 }} onValueChange={onValueChange}>
        <ListingFilters.Rating />
      </ListingFilters.Root>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'All' }))

    expect(onValueChange).toHaveBeenLastCalledWith({
      priceRange: [2000, 8000],
      rating: null,
    })
  })

  it('labels both price slider thumbs', () => {
    render(
      <ListingFilters.Root defaultPriceRange={[1000, 4000]}>
        <ListingFilters.Price />
      </ListingFilters.Root>,
    )

    expect(screen.getByRole('slider', { name: 'Minimum price' })).toHaveAttribute('aria-valuetext', '1,000 euros')
    expect(screen.getByRole('slider', { name: 'Maximum price' })).toHaveAttribute('aria-valuetext', '4,000 euros')
  })
})
