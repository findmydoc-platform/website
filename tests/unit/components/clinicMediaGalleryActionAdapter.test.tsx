// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClinicMediaGalleryAction } from '@/app/(payload)/components/ClinicMediaGalleryAction'

vi.mock('@payloadcms/ui', () => ({
  Button: ({ children, disabled, onClick }: Pick<ComponentProps<'button'>, 'children' | 'disabled' | 'onClick'>) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  useAuth: () => ({ user: { collection: 'platformStaff' } }),
  useDocumentInfo: () => ({ id: 4, apiURL: '/api/clinicMedia/4' }),
  useForm: () => ({ setProcessing: vi.fn() }),
  useFormModified: () => false,
  useFormProcessing: () => false,
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const galleryError = 'The gallery action rejected this fixture image.'
const unavailableError = 'The gallery service paused writes for this fixture.'

describe('clinic media gallery action', () => {
  it.each([
    { body: { error: galleryError }, message: galleryError, status: 422 },
    {
      body: { error: { code: 'FIXTURE_UNAVAILABLE' }, errors: [{ message: unavailableError }] },
      message: unavailableError,
      status: 503,
    },
  ])('shows the server message for a rejected $status response', async ({ body, message, status }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })))
    render(<ClinicMediaGalleryAction />)
    fireEvent.click(screen.getByRole('button', { name: 'Add to clinic gallery' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})
