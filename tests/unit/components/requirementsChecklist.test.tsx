// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RequirementsChecklist } from '@/app/(payload)/components/RequirementsChecklist'

describe('RequirementsChecklist', () => {
  it('renders arbitrary prerequisites without collection-specific knowledge', () => {
    render(
      <RequirementsChecklist
        inactiveSummary="Requirements apply after publication."
        isEnforced
        items={[
          { id: 'content', label: 'Content', status: 'complete' },
          { id: 'owner', label: 'Owner', status: 'incomplete' },
        ]}
        title="Publication requirements"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Publication requirements' })).toBeInTheDocument()
    expect(screen.getByText('1 requirement is incomplete.')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('announces loading and unavailable requirement states', () => {
    const { rerender } = render(
      <RequirementsChecklist
        inactiveSummary="Requirements apply after publication."
        isEnforced
        items={[{ id: 'owner', label: 'Owner', status: 'loading' }]}
        title="Publication requirements"
      />,
    )

    expect(screen.getByText('Checking requirements…')).toBeInTheDocument()
    expect(screen.getByText('Checking')).toBeInTheDocument()

    rerender(
      <RequirementsChecklist
        inactiveSummary="Requirements apply after publication."
        isEnforced
        items={[{ id: 'owner', label: 'Owner', status: 'error' }]}
        title="Publication requirements"
      />,
    )

    expect(screen.getByText('Some requirements could not be checked.')).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })
})
