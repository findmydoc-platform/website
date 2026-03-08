// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: (props: unknown) => {
    const {
      blurDataURL: _blurDataURL,
      fill: _fill,
      loader: _loader,
      placeholder: _placeholder,
      priority: _priority,
      quality: _quality,
      sizes: _sizes,
      ...rest
    } = props as Record<string, unknown>

    return React.createElement('img', rest)
  },
}))

import { LandingCategoriesClient, type LandingCategoryItem } from '@/components/organisms/Landing/LandingCategories'

const items: LandingCategoryItem[] = [
  {
    id: 'nose-item',
    title: 'Nose Item',
    subtitle: 'Hidden specialty',
    categories: ['nose'],
    href: '/listing-comparison?specialty=nose-item',
    image: { src: '/images/placeholder-576-968.svg', alt: 'Nose item image' },
  },
  {
    id: 'dental-item',
    title: 'Dental Item',
    subtitle: 'Dental category',
    categories: ['dental'],
    href: '/listing-comparison?specialty=dental-item',
    image: { src: '/images/placeholder-576-968.svg', alt: 'Dental item image' },
  },
  {
    id: 'eyes-item',
    title: 'Eyes Item',
    subtitle: 'Eyes category',
    categories: ['eyes'],
    href: '/listing-comparison?specialty=eyes-item',
    image: { src: '/images/placeholder-576-968.svg', alt: 'Eyes item image' },
  },
  {
    id: 'hair-item',
    title: 'Hair Item',
    subtitle: 'Hair category',
    categories: ['hair'],
    href: '/listing-comparison?specialty=hair-item',
    image: { src: '/images/placeholder-576-968.svg', alt: 'Hair item image' },
  },
  {
    id: 'skin-item',
    title: 'Skin Item',
    subtitle: 'Skin category',
    categories: ['skin'],
    href: '/listing-comparison?specialty=skin-item',
    image: { src: '/images/placeholder-576-968.svg', alt: 'Skin item image' },
  },
]

describe('LandingCategoriesClient', () => {
  const categories = [
    { label: 'Dental', value: 'dental' },
    { label: 'Eyes', value: 'eyes' },
    { label: 'Hair', value: 'hair' },
    { label: 'Skin', value: 'skin' },
    { label: 'Nose', value: 'nose' },
  ]

  it('renders All as first tab and shows every available specialty tab', () => {
    render(
      <LandingCategoriesClient
        title="Categories"
        description="Explore specialties"
        categories={categories}
        items={items}
      />,
    )

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['All', 'Dental', 'Eyes', 'Hair', 'Skin', 'Nose'])
  })

  it('shows the clinic-focused default CTA in All view', () => {
    render(
      <LandingCategoriesClient
        title="Categories"
        description="Explore specialties"
        categories={categories}
        items={items}
      />,
    )

    const ctaLink = screen.getByRole('link', { name: 'View all clinics' })
    expect(ctaLink).toBeInTheDocument()
    expect(ctaLink).toHaveAttribute('href', '/listing-comparison')
  })

  it('filters cards when a specialty tab is selected', () => {
    render(
      <LandingCategoriesClient
        title="Categories"
        description="Explore specialties"
        categories={categories}
        items={items}
      />,
    )

    const noseTab = screen.getByRole('tab', { name: 'Nose' })
    fireEvent.click(noseTab)

    expect(noseTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('Nose Item')).toBeInTheDocument()
    const ctaLink = screen.getByRole('link', { name: 'More clinics in Nose' })
    expect(ctaLink).toBeInTheDocument()
    expect(ctaLink).toHaveAttribute('href', '/listing-comparison?specialty=nose')
  })
})
