// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/templates/ClinicRegistrationFunnel', () => ({
  ClinicRegistrationFunnel: () => <div data-testid="clinic-registration-funnel" />,
}))

import { ClinicRegistrationLandingSection } from '@/app/(frontend)/_components/ClinicRegistrationLandingSection'

describe('ClinicRegistrationLandingSection', () => {
  it('renders CMS-owned registration intro copy above the funnel', () => {
    render(
      <ClinicRegistrationLandingSection
        title="CMS registration title"
        description="CMS registration description."
        treatmentCategories={[]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'CMS registration title' })).toBeInTheDocument()
    expect(screen.getByText('CMS registration description.')).toBeInTheDocument()
    expect(screen.getByTestId('clinic-registration-funnel')).toBeInTheDocument()
  })
})
