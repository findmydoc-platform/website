import { describe, expect, it } from 'vitest'

import type { ListingCardData } from '@/components/organisms/Listing'
import { sortListingComparison, getSortLabel, SORT_OPTIONS } from '@/utilities/listingComparison/sort'

const baseClinic: ListingCardData = {
  rank: 1,
  name: 'Example Clinic',
  location: 'Berlin, Mitte',
  media: { src: '/images/placeholder-576-968.svg', alt: 'Placeholder' },
  verification: { variant: 'gold' },
  rating: { value: 4.5, count: 10 },
  waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
  tags: ['Hip replacement', 'Modern facilities'],
  priceFrom: { label: 'From', value: 7500, currency: 'EUR' },
  actions: {
    details: { href: '#', label: 'Details' },
    compare: { href: '#', label: 'Compare' },
  },
}

describe('sortListingComparison', () => {
  it('preserves original order for best match (rank)', () => {
    const clinics: ListingCardData[] = [
      { ...baseClinic, rank: 3, name: 'Clinic C' },
      { ...baseClinic, rank: 1, name: 'Clinic A' },
      { ...baseClinic, rank: 2, name: 'Clinic B' },
    ]

    const result = sortListingComparison(clinics, 'rank')
    // 'rank' maps to the UI label "Best match" and should preserve the
    // upstream/default ordering rather than attempting to sort by a removed
    // `rank` property.
    expect(result.map((c) => c.rank)).toEqual([3, 1, 2])
  })

  it('sorts by price ascending (low to high)', () => {
    const clinics: ListingCardData[] = [
      { ...baseClinic, rank: 1, name: 'Expensive', priceFrom: { label: 'From', value: 10000, currency: 'EUR' } },
      { ...baseClinic, rank: 2, name: 'Cheap', priceFrom: { label: 'From', value: 5000, currency: 'EUR' } },
      { ...baseClinic, rank: 3, name: 'Medium', priceFrom: { label: 'From', value: 7500, currency: 'EUR' } },
    ]

    const result = sortListingComparison(clinics, 'price-asc')
    expect(result.map((c) => c.name)).toEqual(['Cheap', 'Medium', 'Expensive'])
  })

  it('sorts by price descending (high to low)', () => {
    const clinics: ListingCardData[] = [
      { ...baseClinic, rank: 1, name: 'Cheap', priceFrom: { label: 'From', value: 5000, currency: 'EUR' } },
      { ...baseClinic, rank: 2, name: 'Expensive', priceFrom: { label: 'From', value: 10000, currency: 'EUR' } },
      { ...baseClinic, rank: 3, name: 'Medium', priceFrom: { label: 'From', value: 7500, currency: 'EUR' } },
    ]

    const result = sortListingComparison(clinics, 'price-desc')
    expect(result.map((c) => c.name)).toEqual(['Expensive', 'Medium', 'Cheap'])
  })

  it('places clinics without price at the end when sorting by price ascending', () => {
    const clinics: ListingCardData[] = [
      { ...baseClinic, rank: 1, name: 'No Price', priceFrom: undefined },
      { ...baseClinic, rank: 2, name: 'With Price', priceFrom: { label: 'From', value: 5000, currency: 'EUR' } },
    ]

    const result = sortListingComparison(clinics, 'price-asc')
    expect(result.map((c) => c.name)).toEqual(['With Price', 'No Price'])
  })

  it('places clinics without price at the end when sorting by price descending', () => {
    const clinics: ListingCardData[] = [
      { ...baseClinic, rank: 1, name: 'No Price', priceFrom: undefined },
      { ...baseClinic, rank: 2, name: 'With Price', priceFrom: { label: 'From', value: 5000, currency: 'EUR' } },
    ]

    const result = sortListingComparison(clinics, 'price-desc')
    expect(result.map((c) => c.name)).toEqual(['With Price', 'No Price'])
  })

  it('sorts by rating descending (highest rated first)', () => {
    const clinics: ListingCardData[] = [
      { ...baseClinic, rank: 1, name: 'Medium Rating', rating: { value: 3.5, count: 10 } },
      { ...baseClinic, rank: 2, name: 'High Rating', rating: { value: 4.8, count: 20 } },
      { ...baseClinic, rank: 3, name: 'Low Rating', rating: { value: 2.5, count: 5 } },
    ]

    const result = sortListingComparison(clinics, 'rating-desc')
    expect(result.map((c) => c.name)).toEqual(['High Rating', 'Medium Rating', 'Low Rating'])
  })

  it('sorts by name alphabetically (A-Z)', () => {
    const clinics: ListingCardData[] = [
      { ...baseClinic, rank: 1, name: 'Zebra Clinic' },
      { ...baseClinic, rank: 2, name: 'Alpha Clinic' },
      { ...baseClinic, rank: 3, name: 'Beta Clinic' },
    ]

    const result = sortListingComparison(clinics, 'name-asc')
    expect(result.map((c) => c.name)).toEqual(['Alpha Clinic', 'Beta Clinic', 'Zebra Clinic'])
  })

  it('does not mutate the original array', () => {
    const clinics: ListingCardData[] = [
      { ...baseClinic, rank: 3, name: 'Clinic C' },
      { ...baseClinic, rank: 1, name: 'Clinic A' },
      { ...baseClinic, rank: 2, name: 'Clinic B' },
    ]

    const originalOrder = clinics.map((c) => c.name)
    sortListingComparison(clinics, 'rank')

    expect(clinics.map((c) => c.name)).toEqual(originalOrder)
  })
})

describe('getSortLabel', () => {
  it('returns correct labels for all sort options', () => {
    expect(getSortLabel('rank')).toBe('Best match')
    expect(getSortLabel('price-asc')).toBe('Price: Low to High')
    expect(getSortLabel('price-desc')).toBe('Price: High to Low')
    expect(getSortLabel('rating-desc')).toBe('Highest rated')
    expect(getSortLabel('name-asc')).toBe('Name: A-Z')
  })
})

describe('SORT_OPTIONS', () => {
  it('contains all sort options with labels', () => {
    expect(SORT_OPTIONS).toHaveLength(5)
    expect(SORT_OPTIONS).toEqual([
      { value: 'rank', label: 'Best match' },
      { value: 'price-asc', label: 'Price: Low to High' },
      { value: 'price-desc', label: 'Price: High to Low' },
      { value: 'rating-desc', label: 'Highest rated' },
      { value: 'name-asc', label: 'Name: A-Z' },
    ])
  })
})
