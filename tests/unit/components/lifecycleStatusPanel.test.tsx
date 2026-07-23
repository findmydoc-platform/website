// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LifecycleStatusPanel } from '@/app/(payload)/components/LifecycleStatusPanel'

describe('LifecycleStatusPanel', () => {
  it('renders a domain-neutral, labelled status region with announced summary and details', () => {
    render(
      <LifecycleStatusPanel
        details={[
          { label: 'Current state', value: 'Pending' },
          { label: 'After save', value: 'Approved' },
        ]}
        guidance="Save to continue."
        stateLabel="Action selected"
        summary="Saving starts the configured process."
        title="Process lifecycle"
        tone="warning"
      />,
    )

    const panel = screen.getByRole('region', { name: 'Process lifecycle' })
    expect(panel).toHaveAttribute('data-lifecycle-state', 'Action selected')
    expect(screen.getByText('Saving starts the configured process.')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Current state').tagName).toBe('DT')
    expect(screen.getByText('Pending').tagName).toBe('DD')
    expect(screen.getByText('Save to continue.')).toBeInTheDocument()
  })

  it.each(['error', 'info', 'success', 'warning'] as const)('exposes the %s state through text and styling', (tone) => {
    render(
      <LifecycleStatusPanel
        guidance="Next action"
        stateLabel={`${tone} state`}
        summary="State summary"
        title={`${tone} lifecycle`}
        tone={tone}
      />,
    )

    const panel = screen.getByRole('region', { name: `${tone} lifecycle` })
    expect(panel).toHaveClass(`lifecycle-status-panel--${tone}`)
    expect(screen.getByText(`${tone} state`)).toBeVisible()
  })
})
