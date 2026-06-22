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
    expect(screen.getByTestId('clinic-location-placeholder-map')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Directions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Expand map' })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Map preview of Test Clinic')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Interactive map of Test Clinic')).not.toBeInTheDocument()
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

    const previewMap = screen.getByTitle('Map preview of Test Clinic')

    expect(previewMap).not.toHaveClass('pointer-events-none')
    expect(previewMap).toHaveAttribute('tabindex', '0')
    expect(screen.getByTestId('map-preview-interaction-guard')).toBeInTheDocument()
    expect(screen.getByTestId('map-preview-interaction-guard-top')).toHaveClass('right-[72px]', 'h-[120px]')
    expect(screen.getByTestId('map-preview-interaction-guard-body')).toHaveClass('top-[120px]')

    fireEvent.click(screen.getByRole('button', { name: 'Expand map' }))

    const dialog = screen.getByRole('dialog', { name: 'Expanded Map View' })
    const expandedMap = screen.getByTitle('Interactive map of Test Clinic')

    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View map in OpenStreetMap' })).toBeInTheDocument()
    expect(expandedMap).not.toHaveClass('pointer-events-none')
    expect(expandedMap).toHaveAttribute('tabindex', '-1')
    expect(screen.getByTestId('map-preview-interaction-guard')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Expanded map keyboard controls' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pan map north' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zoom map in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset map view' })).not.toBeInTheDocument()

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
