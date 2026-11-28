// @vitest-environment jsdom

import '@testing-library/jest-dom'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FavoriteClinicButton } from '@/features/favorites/FavoriteClinicButton'

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })
}

describe('FavoriteClinicButton', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders a login link for guests', () => {
    render(<FavoriteClinicButton clinicId={12} isPatient={false} loginHref="/login/patient?next=%2Fclinics%2Fabc" />)

    const link = screen.getByRole('link', { name: 'Save' })
    expect(link).toHaveAttribute('href', '/login/patient?next=%2Fclinics%2Fabc')
  })

  it('renders the icon variant with an accessible name', () => {
    render(
      <FavoriteClinicButton
        clinicId={12}
        isPatient={false}
        loginHref="/login/patient?next=%2Flisting-comparison"
        variant="icon"
      />,
    )

    expect(screen.getByRole('link', { name: 'Save' })).toHaveAttribute(
      'href',
      '/login/patient?next=%2Flisting-comparison',
    )
  })

  it('uses state-specific accessible names when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 55 }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <FavoriteClinicButton
        clinicId={12}
        isPatient={true}
        loginHref="/login/patient?next=%2Flisting-comparison"
        variant="icon"
        savedAriaLabel="Remove Alpha Clinic from saved clinics"
        unsavedAriaLabel="Save Alpha Clinic to saved clinics"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save Alpha Clinic to saved clinics' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove Alpha Clinic from saved clinics' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
  })

  it('creates a favorite and reflects the saved state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 55 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<FavoriteClinicButton clinicId={12} isPatient={true} loginHref="/login/patient?next=%2Fclinics%2Fabc" />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true'))
    expect(fetchMock).toHaveBeenCalledWith('/api/favoriteclinics', expect.objectContaining({ method: 'POST' }))
  })

  it('deletes a favorite and reflects the unsaved state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 55 }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <FavoriteClinicButton
        clinicId={12}
        initialFavoriteId={55}
        isPatient={true}
        loginHref="/login/patient?next=%2Fclinics%2Fabc"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Saved' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-pressed', 'false'))
    expect(fetchMock).toHaveBeenCalledWith('/api/favoriteclinics/55', expect.objectContaining({ method: 'DELETE' }))
  })

  it('renders the list variant without an icon when requested', () => {
    render(
      <FavoriteClinicButton
        clinicId={12}
        initialFavoriteId={55}
        isPatient={true}
        loginHref="/login/patient?next=%2Fclinics%2Fabc"
        variant="list"
        savedLabel="Remove"
        showIcon={false}
      />,
    )

    const button = screen.getByRole('button', { name: 'Remove' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.querySelector('svg')).toBeNull()
  })

  it('reconciles duplicate creates by refetching the existing favorite', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'duplicate' }, { status: 409 }))
      .mockResolvedValueOnce(jsonResponse({ docs: [{ id: 91 }] }))
    vi.stubGlobal('fetch', fetchMock)

    render(<FavoriteClinicButton clinicId={12} isPatient={true} loginHref="/login/patient?next=%2Fclinics%2Fabc" />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true'))
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/api/favoriteclinics?'), expect.any(Object))
  })

  it('keeps the previous state and shows an inline error when saving fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Network unavailable' }, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ docs: [] }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <FavoriteClinicButton
        clinicId={12}
        isPatient={true}
        loginHref="/login/patient?next=%2Fclinics%2Fabc"
        feedback={{ error: 'Synthetic save error', saved: 'Synthetic success', removed: 'Synthetic removal' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Synthetic save error'))
    expect(screen.queryByText('Network unavailable')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers the same return destination when a patient session expires during removal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'Forbidden' }, { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)
    const loginHref = '/en/login/patient?next=%2Fen%2Fpatient%2Ffavorites'
    render(
      <FavoriteClinicButton
        clinicId={12}
        initialFavoriteId={55}
        isPatient={true}
        loginHref={loginHref}
        reauthenticateLabel="Synthetic sign-in action"
        savedLabel="Synthetic remove action"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Synthetic remove action' }))

    expect(await screen.findByRole('link', { name: 'Synthetic sign-in action' })).toHaveAttribute('href', loginHref)
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument()
  })
})
