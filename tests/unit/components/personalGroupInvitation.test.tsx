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
  it('identifies missing and invalid contact fields after blur and clears corrected errors', () => {
    const invite = vi.fn()
    render(<PersonalGroupInvitationPanel onInvite={invite} />)
    const email = screen.getByLabelText('Personal email')
    const firstName = screen.getByLabelText('First name')
    expect(screen.queryByText('Enter a valid personal email address.')).not.toBeInTheDocument()
    fireEvent.change(email, { target: { value: 'invalid' } })
    fireEvent.blur(email)
    fireEvent.blur(firstName)
    expect(email).toHaveAccessibleDescription('Enter a valid personal email address.')
    expect(firstName).toHaveAccessibleDescription('Enter a first name.')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(email, { target: { value: 'manager@example.test' } })
    fireEvent.change(firstName, { target: { value: 'New' } })
    expect(email).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Enter a first name.')).not.toBeInTheDocument()
    expect(screen.getByText(/All contact fields and the authorization confirmation are required/)).toBeVisible()
    expect(invite).not.toHaveBeenCalled()
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
