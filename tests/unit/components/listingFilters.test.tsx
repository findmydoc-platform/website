// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ListingFilters } from '@/components/organisms/Listing/ListingFilters'

describe('ListingFilters', () => {
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
})
