// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const admin = vi.hoisted(() => ({ dirty: false, role: 'support', processing: vi.fn(), apiURL: '/api/clinicGroups/4' }))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({ user: { collection: 'platformStaff', role: admin.role } }),
  useDocumentInfo: () => ({ id: 4, apiURL: admin.apiURL }),
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
  admin.apiURL = '/api/clinicGroups/4'
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
  it('posts to the invitation action when the native document URL contains query parameters', async () => {
    admin.apiURL = '/api/clinicGroups/4?locale=en&draft=true#edit'
    const requestedURLs: URL[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = new URL(input, window.location.origin)
        requestedURLs.push(url)
        return url.pathname.endsWith('/personal-invitation')
          ? Response.json({ staffId: 8, invitation: 'prepared' })
          : Response.json({ errors: [{ message: 'Not found' }] }, { status: 404 })
      }),
    )
    render(<PersonalGroupInvitation />)
    enterPerson()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare personal invitation' }))
    await expect(screen.findByRole('status')).resolves.toHaveTextContent(
      'The personal invitation is prepared for delivery.',
    )
    expect(requestedURLs[0]).toMatchObject({
      pathname: '/api/clinicGroups/4/personal-invitation',
      search: '',
      hash: '',
    })
  })

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
      new URL('/api/clinicGroups/4/personal-invitation', window.location.origin).href,
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
