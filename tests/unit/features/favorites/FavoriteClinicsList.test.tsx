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
      src: '/images/placeholder-576-968.svg',
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
      src: '/images/placeholder-576-968.svg',
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

    expect(screen.getByRole('heading', { level: 1, name: 'Saved clinics' })).toBeInTheDocument()
    expect(screen.getByText('2 saved clinics in your patient account.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'No saved clinics yet' })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Saved clinics list' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'View details for Berlin University Hospital' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View details for Munich Medical Center' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove Berlin University Hospital from saved clinics' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Munich Medical Center from saved clinics' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Browse clinics' })).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'Compare' })).not.toBeInTheDocument()
  })

  it('renders the empty state with one browse action when no clinics are saved', () => {
    render(<FavoriteClinicsList initialItems={[]} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Saved clinics' })).toBeInTheDocument()
    expect(screen.getByText('0 saved clinics in your patient account.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No saved clinics yet' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Browse clinics' })).toHaveLength(1)
    expect(screen.queryByLabelText('Saved clinics list')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Details' })).not.toBeInTheDocument()
  })

  it('moves focus to the next saved clinic and announces successful removal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 41 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<FavoriteClinicsList initialItems={savedClinicItems} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Berlin University Hospital from saved clinics' }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Berlin University Hospital' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Removed Berlin University Hospital from saved clinics.')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'View details for Munich Medical Center' })).toHaveFocus(),
    )
  })

  it('transitions to the empty state after removing the last saved clinic', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 41 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<FavoriteClinicsList initialItems={[savedClinicItems[0] as FavoriteClinicListItem]} />)

    const list = screen.getByLabelText('Saved clinics list')
    expect(within(list).getByRole('heading', { name: 'Berlin University Hospital' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Berlin University Hospital from saved clinics' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'No saved clinics yet' })).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Berlin University Hospital' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Browse clinics' })).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Removed Berlin University Hospital from saved clinics.')
    await waitFor(() => expect(screen.getByRole('link', { name: 'Browse clinics' })).toHaveFocus())
    expect(fetchMock).toHaveBeenCalledWith('/api/favoriteclinics/41', expect.objectContaining({ method: 'DELETE' }))
  })
})
