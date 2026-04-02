// @vitest-environment jsdom

import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
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
    expect(screen.queryByTitle('Map of Test Clinic')).not.toBeInTheDocument()
  })
})
