// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PersonalGroupInvitationPanel } from '@/app/(payload)/components/PersonalGroupInvitation/Panel'
afterEach(cleanup)
describe('personal group invitation operator control', () => {
  it('requires personal contact details and explicit confirmation of group access', async () => {
    const invite = vi.fn().mockResolvedValue(undefined)
    render(<PersonalGroupInvitationPanel onInvite={invite} />)
    const action = screen.getByRole('button', { name: 'Prepare personal invitation' })
    expect(action).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Personal email'), { target: { value: 'manager@example.test' } })
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'New' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Manager' } })
    expect(action).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(action)
    await waitFor(() =>
      expect(invite).toHaveBeenCalledWith({ email: 'manager@example.test', firstName: 'New', lastName: 'Manager' }),
    )
  })
  it('announces an unknown result and blocks submissions while the group has unsaved changes', () => {
    render(
      <PersonalGroupInvitationPanel
        dirty
        error="Preparation is unconfirmed. Retry the same person."
        onInvite={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Preparation is unconfirmed. Retry the same person.')
    expect(screen.getByRole('button', { name: 'Prepare personal invitation' })).toBeDisabled()
    expect(screen.getByText('Save or discard group changes before preparing an invitation.')).toBeVisible()
  })
})
