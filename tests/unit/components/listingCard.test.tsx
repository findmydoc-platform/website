// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ListingCard, type ListingCardData } from '@/components/organisms/Listing'

const baseCard: ListingCardData = {
  id: 'listing-card-test',
  name: 'Accessible Clinic',
  location: 'Berlin, Mitte',
  media: {
    src: '/images/placeholders/clinic-placeholder.webp',
    alt: 'Accessible Clinic image',
  },
  verification: {
    variant: 'gold',
  },
  rating: {
    value: 4.8,
    count: 12,
  },
  tags: ['Orthopedics'],
  actions: {
    details: {
      href: '/clinics/accessible-clinic',
      label: 'Details',
      ariaLabel: 'View details for Accessible Clinic',
    },
    compare: {
      href: '#compare',
      label: 'Compare',
      ariaLabel: 'Compare Accessible Clinic',
    },
  },
}

describe('ListingCard', () => {
  it('uses clinic-specific accessible names for repeated card actions', () => {
    render(<ListingCard data={baseCard} />)

    expect(screen.getByRole('link', { name: 'View details for Accessible Clinic' })).toHaveAttribute(
      'href',
      '/clinics/accessible-clinic',
    )
    expect(screen.getByRole('link', { name: 'Compare Accessible Clinic' })).toHaveAttribute('href', '#compare')
  })
})
