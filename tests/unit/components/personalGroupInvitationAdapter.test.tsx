// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const admin = vi.hoisted(() => ({ dirty: false, role: 'support', processing: vi.fn() }))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({ user: { collection: 'platformStaff', role: admin.role } }),
  useDocumentInfo: () => ({ id: 4, apiURL: '/api/clinicGroups/4' }),
  useForm: () => ({ setProcessing: admin.processing }),
  useFormModified: () => admin.dirty,
  useFormProcessing: () => false,
}))
import { PersonalGroupInvitation } from '@/app/(payload)/components/PersonalGroupInvitation'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  admin.dirty = false
  admin.role = 'support'
  admin.processing.mockClear()
})
function enterPerson() {
  fireEvent.change(screen.getByLabelText('Personal email'), { target: { value: 'manager@example.test' } })
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'New' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Manager' } })
  fireEvent.click(screen.getByRole('checkbox'))
}
describe('personal group invitation native Admin transport', () => {
  it.each([
    ['inactive', 'Invitation delivery is inactive in this environment.'],
    ['ineligible', 'Use the existing invitation or the separate recovery workflow.'],
  ])('reports %s delivery without claiming a sent invitation', async (invitation, message) => {
    const fetcher = vi.fn(async () => Response.json({ staffId: 8, invitation }))
    vi.stubGlobal('fetch', fetcher)
    render(<PersonalGroupInvitation />)
    enterPerson()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare personal invitation' }))
    await expect(screen.findByRole('status')).resolves.toHaveTextContent(message)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/clinicGroups/4/personal-invitation',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email: 'manager@example.test', firstName: 'New', lastName: 'Manager' }),
      }),
    )
    expect(admin.processing).toHaveBeenLastCalledWith(false)
  })
  it('retains the same personal input for retry after an unconfirmed outcome', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Preparation is unconfirmed. Retry the same person.'))
      .mockResolvedValueOnce(Response.json({ staffId: 8, invitation: 'prepared' }))
    vi.stubGlobal('fetch', fetcher)
    render(<PersonalGroupInvitation />)
    enterPerson()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare personal invitation' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Personal email')).toHaveValue('manager@example.test')
    fireEvent.click(screen.getByRole('button', { name: 'Prepare personal invitation' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('The personal invitation is prepared for delivery.'),
    )
    expect(fetcher.mock.calls[0]).toEqual(fetcher.mock.calls[1])
  })
})
