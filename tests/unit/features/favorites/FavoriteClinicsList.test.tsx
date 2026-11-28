// @vitest-environment jsdom

import '@testing-library/jest-dom'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FavoriteClinicsList } from '@/features/favorites/FavoriteClinicsList.client'
import type { FavoriteClinicListItem } from '@/features/favorites/server'

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

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })
}

const savedClinicItems: FavoriteClinicListItem[] = [
  {
    favoriteId: 41,
    clinicId: 101,
    name: 'Berlin University Hospital',
    href: '/clinics/berlin-university-hospital',
    location: 'Berlin, Germany',
    media: {
      src: '/images/placeholders/clinic-placeholder.webp',
      alt: 'Berlin University Hospital image',
    },
    verification: {
      variant: 'gold',
    },
    ratingValue: 4.8,
  },
  {
    favoriteId: 42,
    clinicId: 102,
    name: 'Munich Medical Center',
    href: '/clinics/munich-medical-center',
    location: 'Munich, Germany',
    media: {
      src: '/images/placeholders/clinic-placeholder.webp',
      alt: 'Munich Medical Center image',
    },
    verification: {
      variant: 'silver',
    },
    ratingValue: 4.6,
  },
]

describe('FavoriteClinicsList', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders saved clinics without showing the empty state', () => {
    render(<FavoriteClinicsList initialItems={savedClinicItems} />)

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    const list = screen.getByRole('list')
    expect(list).toHaveAccessibleName()
    expect(within(list).getAllByRole('article')).toHaveLength(2)
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/clinics/berlin-university-hospital', '/clinics/munich-medical-center'])
  })

  it.each([
    ['de', '/listing-comparison'],
    ['en', '/en/listing-comparison'],
  ] as const)('offers the %s comparison route when no clinics are saved', (locale, href) => {
    render(<FavoriteClinicsList initialItems={[]} locale={locale} />)

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', href)
  })

  it('moves focus to the next saved clinic and announces successful removal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 41 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<FavoriteClinicsList initialItems={savedClinicItems} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Berlin University Hospital from saved clinics' }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Berlin University Hospital' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Berlin University Hospital')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'View details for Munich Medical Center' })).toHaveFocus(),
    )
  })

  it('transitions to the empty state after removing the last saved clinic', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 41 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<FavoriteClinicsList initialItems={[savedClinicItems[0] as FavoriteClinicListItem]} />)

    const list = screen.getByRole('list')
    expect(within(list).getByRole('heading', { name: 'Berlin University Hospital' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Berlin University Hospital from saved clinics' }))

    await waitFor(() => expect(screen.queryByRole('list')).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Berlin University Hospital' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Berlin University Hospital')
    await waitFor(() => expect(screen.getByRole('link')).toHaveFocus())
    expect(fetchMock).toHaveBeenCalledWith('/api/favoriteclinics/41', expect.objectContaining({ method: 'DELETE' }))
  })
})
