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
  const findAnimatedContainer = (node: HTMLElement): HTMLElement => {
    let current: HTMLElement | null = node

    while (current) {
      if (current.className.includes('transition-all duration-700 ease-in-out')) {
        return current
      }
      current = current.parentElement
    }

    throw new Error('Animated container not found')
  }

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

  it('parks hidden specialties in category-specific offstage slots instead of the shared center slot', () => {
    render(
      <LandingCategoriesClient
        title="Categories"
        description="Explore specialties"
        categories={categories}
        items={items}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Nose' }))

    const dentalContainer = findAnimatedContainer(screen.getByAltText('Dental item image'))
    const skinContainer = findAnimatedContainer(screen.getByAltText('Skin item image'))

    expect(dentalContainer.className).not.toContain('top-1/2 left-1/2 h-0 w-0')
    expect(skinContainer.className).not.toContain('top-1/2 left-1/2 h-0 w-0')
    expect(dentalContainer.className).not.toEqual(skinContainer.className)
  })

  it('fans cards from the same category across different offstage sides', () => {
    const repeatedCategoryItems: LandingCategoryItem[] = [
      {
        id: 'dental-item-a',
        title: 'Dental Item A',
        categories: ['dental'],
        image: { src: '/images/placeholder-576-968.svg', alt: 'Dental item A image' },
      },
      {
        id: 'dental-item-b',
        title: 'Dental Item B',
        categories: ['dental'],
        image: { src: '/images/placeholder-576-968.svg', alt: 'Dental item B image' },
      },
      {
        id: 'dental-item-c',
        title: 'Dental Item C',
        categories: ['dental'],
        image: { src: '/images/placeholder-576-968.svg', alt: 'Dental item C image' },
      },
      {
        id: 'dental-item-d',
        title: 'Dental Item D',
        categories: ['dental'],
        image: { src: '/images/placeholder-576-968.svg', alt: 'Dental item D image' },
      },
      {
        id: 'nose-item-a',
        title: 'Nose Item A',
        categories: ['nose'],
        image: { src: '/images/placeholder-576-968.svg', alt: 'Nose item A image' },
      },
    ]

    render(
      <LandingCategoriesClient
        title="Categories"
        description="Explore specialties"
        categories={[
          { label: 'Dental', value: 'dental' },
          { label: 'Nose', value: 'nose' },
        ]}
        items={repeatedCategoryItems}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Nose' }))

    const dentalClassNames = [
      findAnimatedContainer(screen.getByAltText('Dental item A image')).className,
      findAnimatedContainer(screen.getByAltText('Dental item B image')).className,
      findAnimatedContainer(screen.getByAltText('Dental item C image')).className,
      findAnimatedContainer(screen.getByAltText('Dental item D image')).className,
    ]

    expect(new Set(dentalClassNames).size).toBe(4)
    dentalClassNames.forEach((className) => {
      expect(className).not.toContain('top-1/2 left-1/2 h-0 w-0')
    })
  })

  it('keeps the parking layout stable when item order changes', () => {
    const firstRender = render(
      <LandingCategoriesClient
        title="Categories"
        description="Explore specialties"
        categories={categories}
        items={items}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Nose' }))

    const baselineDentalClassName = findAnimatedContainer(screen.getByAltText('Dental item image')).className
    const baselineEyesClassName = findAnimatedContainer(screen.getByAltText('Eyes item image')).className
    const baselineHairClassName = findAnimatedContainer(screen.getByAltText('Hair item image')).className
    const baselineSkinClassName = findAnimatedContainer(screen.getByAltText('Skin item image')).className

    firstRender.unmount()

    render(
      <LandingCategoriesClient
        title="Categories"
        description="Explore specialties"
        categories={categories}
        items={[...items].reverse()}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Nose' }))

    expect(findAnimatedContainer(screen.getByAltText('Dental item image')).className).toBe(baselineDentalClassName)
    expect(findAnimatedContainer(screen.getByAltText('Eyes item image')).className).toBe(baselineEyesClassName)
    expect(findAnimatedContainer(screen.getByAltText('Hair item image')).className).toBe(baselineHairClassName)
    expect(findAnimatedContainer(screen.getByAltText('Skin item image')).className).toBe(baselineSkinClassName)
  })
})
