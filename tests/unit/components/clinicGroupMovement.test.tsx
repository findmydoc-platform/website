// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClinicGroupMovementPanel } from '@/app/(payload)/components/ClinicGroupMovement/Panel'

afterEach(cleanup)
const groups = [
  { id: 1, name: 'Current group' },
  { id: 2, name: 'Destination group' },
]
describe('Clinic group movement Admin control', () => {
  it('requires an explicit destination and access-change confirmation before transferring', async () => {
    const move = vi.fn().mockResolvedValue(undefined)
    render(<ClinicGroupMovementPanel sourceGroupId={1} groups={groups} onMove={move} />)
    const action = screen.getByRole('button', { name: 'Move clinic' })
    expect(action).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: '2' } })
    expect(action).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(action)
    await waitFor(() => expect(move).toHaveBeenCalledWith(2))
    expect(screen.queryByRole('option', { name: 'Current group' })).not.toBeInTheDocument()
  })
  it('detaches explicitly and blocks movement while the clinic form has unsaved changes', async () => {
    const move = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<ClinicGroupMovementPanel sourceGroupId={1} groups={groups} dirty onMove={move} />)
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'independent' } })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: 'Move clinic' })).toBeDisabled()
    expect(screen.getByText('Save or discard the clinic form changes before moving this clinic.')).toBeVisible()
    rerender(<ClinicGroupMovementPanel sourceGroupId={1} groups={groups} onMove={move} />)
    fireEvent.click(screen.getByRole('button', { name: 'Move clinic' }))
    await waitFor(() => expect(move).toHaveBeenCalledWith(null))
  })
  it('announces a failed move and blocks duplicate submission during a pending operation', () => {
    render(
      <ClinicGroupMovementPanel
        sourceGroupId={1}
        groups={groups}
        busy
        error="Membership changed. Reload this clinic."
        onMove={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Membership changed. Reload this clinic.')
    expect(screen.getByRole('button', { name: 'Moving clinic…' })).toBeDisabled()
  })
})
