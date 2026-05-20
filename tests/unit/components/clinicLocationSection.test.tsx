// @vitest-environment jsdom

import '@testing-library/jest-dom'

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ClinicLocationSection } from '@/components/organisms/ClinicDetail'

describe('ClinicLocationSection', () => {
  it('hides OpenStreetMap controls when consent is not granted', () => {
    render(
      <ClinicLocationSection
        clinicName="Test Clinic"
        location={{
          fullAddress: '123 Test Street, Berlin',
          coordinates: { lat: 52.52, lng: 13.405 },
        }}
        isOpenStreetMapAllowed={false}
      />,
    )

    expect(screen.getByText('OpenStreetMap is hidden until optional cookies are accepted.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Directions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Expand map' })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Map of Test Clinic')).not.toBeInTheDocument()
  })

  it('opens the expanded map inside an accessible dialog', async () => {
    render(
      <ClinicLocationSection
        clinicName="Test Clinic"
        location={{
          fullAddress: '123 Test Street, Berlin',
          coordinates: { lat: 52.52, lng: 13.405 },
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand map' }))

    expect(screen.getByRole('dialog', { name: 'Expanded Map View' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close map' }))

    expect(screen.queryByRole('dialog', { name: 'Expanded Map View' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Expand map' })).toHaveFocus())
  })

  it('reports the contact button origin for card and map overlay clicks without stealing parent-managed focus', async () => {
    const onContactClick = vi.fn()
    const contactTargetRef = React.createRef<HTMLElement>()

    render(
      <>
        <ClinicLocationSection
          clinicName="Test Clinic"
          location={{
            fullAddress: '123 Test Street, Berlin',
            coordinates: { lat: 52.52, lng: 13.405 },
          }}
          onContactClick={(origin) => {
            onContactClick(origin)
            contactTargetRef.current?.focus()
          }}
        />
        <section ref={contactTargetRef} tabIndex={-1} aria-label="Clinic appointment request" />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Contact' }))
    const expandMapButton = screen.getByRole('button', { name: 'Expand map' })

    fireEvent.click(expandMapButton)
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Expanded Map View' })).getByRole('button', { name: 'Contact' }),
    )

    expect(onContactClick).toHaveBeenNthCalledWith(1, 'location_card')
    await waitFor(() => expect(onContactClick).toHaveBeenCalledTimes(2))
    expect(onContactClick).toHaveBeenNthCalledWith(2, 'map_overlay')
    expect(screen.queryByRole('dialog', { name: 'Expanded Map View' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('region', { name: 'Clinic appointment request' })).toHaveFocus())
    expect(expandMapButton).not.toHaveFocus()
  })
})
