// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'
import { buildClinicApplicationCopy } from '@/features/uiCopy/clinicApplication'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ClinicRegistrationLandingSection } from '@/app/(frontend)/_components/ClinicRegistrationLandingSection'

const copy = buildClinicApplicationCopy(
  createTranslator({ locale: 'en', messages: englishMessages, namespace: 'website.clinicApplication' }),
)

describe('ClinicRegistrationLandingSection', () => {
  it('renders CMS-owned registration intro copy above the funnel', () => {
    render(
      <ClinicRegistrationLandingSection
        copy={copy}
        locale="en"
        title="CMS registration title"
        description="CMS registration description."
        treatmentCategories={[]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'CMS registration title' })).toBeInTheDocument()
    expect(screen.getByText('CMS registration description.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
