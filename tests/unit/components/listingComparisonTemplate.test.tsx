// @vitest-environment jsdom
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Shield } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'

vi.mock('@/components/molecules/SectionBackground/SectionBackgroundParallax.client', () => ({
  SectionBackgroundParallax: () => null,
}))

const baseResult: ListingCardData = {
  id: 'clinic-template-test',
  name: 'Template Test Clinic',
  location: 'Berlin, Mitte',
  media: {
    src: '/images/placeholder-576-968.svg',
    alt: 'Template test clinic image',
  },
  verification: {
    variant: 'gold',
  },
  rating: {
    value: 4.8,
    count: 12,
  },
  tags: ['Orthopedics'],
  priceFrom: {
    label: 'From',
    value: 4200,
    currency: 'USD',
  },
  actions: {
    details: {
      href: '#details',
      label: 'Details',
    },
    compare: {
      href: '#compare',
      label: 'Compare',
    },
  },
}

describe('ListingComparison template header', () => {
  const hasExactTextContent = (expected: string) => {
    return (_: string, element: Element | null): boolean => {
      if (!element) return false
      const normalizedText = element.textContent?.replace(/\s+/g, ' ').trim()
      return normalizedText === expected
    }
  }

  it('shows singular label when total result count is 1', () => {
    render(
      <ListingComparison
        hero={{ title: 'Compare clinic prices', features: [], bulletStyle: 'circle' }}
        filters={<div>Filters</div>}
        results={[baseResult]}
        totalResultsCount={1}
        sortControl={<div>Sort</div>}
        trust={{
          title: 'Trust proven quality',
          stats: [{ label: 'Verified platform', valueText: 'TÜV', Icon: Shield }],
        }}
      />,
    )

    expect(screen.getByText(hasExactTextContent('Showing 1 of 1 Clinic'))).toBeInTheDocument()
    expect(screen.queryByText(/Total matches/i)).not.toBeInTheDocument()
  })

  it('shows plural label when total result count is greater than 1', () => {
    render(
      <ListingComparison
        hero={{ title: 'Compare clinic prices', features: [], bulletStyle: 'circle' }}
        filters={<div>Filters</div>}
        results={[baseResult]}
        totalResultsCount={3}
        sortControl={<div>Sort</div>}
        trust={{
          title: 'Trust proven quality',
          stats: [{ label: 'Verified platform', valueText: 'TÜV', Icon: Shield }],
        }}
      />,
    )

    expect(screen.getByText(hasExactTextContent('Showing 1 of 3 Clinics'))).toBeInTheDocument()
  })
})
