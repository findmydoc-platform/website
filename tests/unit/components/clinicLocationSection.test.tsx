// @vitest-environment jsdom

import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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
    expect(screen.queryByTitle('Map preview of Test Clinic')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Interactive map of Test Clinic')).not.toBeInTheDocument()
  })

  it('opens the expanded map inside an accessible dialog', () => {
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
  })
})
