// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const admin = vi.hoisted(() => ({
  dirty: false,
  user: { collection: 'platformStaff', role: 'support' },
  processing: vi.fn(),
}))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({ user: admin.user }),
  useConfig: () => ({ config: { routes: { api: '/api' } } }),
  useDocumentInfo: () => ({ id: 4, apiURL: '/api/clinics/4', data: { group: 1 }, initialData: { group: 99 } }),
  useForm: () => ({ setProcessing: admin.processing }),
  useFormModified: () => admin.dirty,
  useFormProcessing: () => false,
}))
import { ClinicGroupMovement } from '@/app/(payload)/components/ClinicGroupMovement'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  admin.dirty = false
  admin.user = { collection: 'platformStaff', role: 'support' }
  admin.processing.mockClear()
})

describe('Clinic group movement transport', () => {
  it('uses the saved current group and dedicated command, and shows a rejected stale operation without claiming success', async () => {
    const fetcher = vi.fn(async (_url: unknown, options?: RequestInit) =>
      options?.method === 'POST'
        ? Response.json(
            { errors: [{ message: 'Clinic group membership changed. Reload before trying again.' }] },
            { status: 409 },
          )
        : Response.json({ docs: [{ id: 2, name: 'Destination network' }], hasNextPage: false }),
    )
    vi.stubGlobal('fetch', fetcher)
    render(<ClinicGroupMovement />)
    await screen.findByRole('option', { name: 'Destination network' })
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Move clinic' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Clinic group membership changed.'))
    expect(fetcher).toHaveBeenCalledWith(
      '/api/clinics/4/group-membership',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ fromGroupId: 1, toGroupId: 2 }),
      }),
    )
    expect(admin.processing).toHaveBeenLastCalledWith(false)
  })
  it('keeps pending clinic form edits out of the separate membership command', async () => {
    admin.dirty = true
    const fetcher = vi.fn(async () => Response.json({ docs: [], hasNextPage: false }))
    vi.stubGlobal('fetch', fetcher)
    render(<ClinicGroupMovement />)
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'independent' } })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: 'Move clinic' })).toBeDisabled()
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
