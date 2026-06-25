// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InviteCompleteForm } from '@/app/(frontend)/auth/invite/complete/InviteCompleteForm'

const expiredRecoveryHref = '/auth/password/reset?reason=expired'

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
}))

const supabaseAuthMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
}))

const hydrateSessionFromHashMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}))

vi.mock('@/auth/utilities/supaBaseClient', () => ({
  createClient: () => ({
    auth: supabaseAuthMock,
  }),
}))

vi.mock('@/auth/utilities/hydrateSessionFromHash', () => ({
  hydrateSessionFromHash: hydrateSessionFromHashMock,
}))

describe('InviteCompleteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hydrateSessionFromHashMock.mockResolvedValue(undefined)
    supabaseAuthMock.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: {},
          },
        },
      },
    })
    supabaseAuthMock.updateUser.mockResolvedValue({ error: null })
  })

  it('redirects hash hydration errors to the reset request page', async () => {
    hydrateSessionFromHashMock.mockRejectedValueOnce(new Error('invalid session'))

    render(<InviteCompleteForm />)

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(expiredRecoveryHref)
    })

    expect(supabaseAuthMock.getSession).not.toHaveBeenCalled()
    expect(screen.queryByText('invalid session')).not.toBeInTheDocument()
  })

  it('redirects missing sessions to the reset request page', async () => {
    supabaseAuthMock.getSession.mockResolvedValueOnce({ data: { session: null } })

    render(<InviteCompleteForm />)

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(expiredRecoveryHref)
    })
    expect(screen.getByRole('button', { name: 'Set password' })).toBeDisabled()
  })

  it('redirects callback errors to the reset request page', async () => {
    render(<InviteCompleteForm error="otp_expired" />)

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(expiredRecoveryHref)
    })

    expect(hydrateSessionFromHashMock).not.toHaveBeenCalled()
    expect(supabaseAuthMock.getSession).not.toHaveBeenCalled()
    expect(screen.queryByText('otp_expired')).not.toBeInTheDocument()
  })

  it('keeps the password form enabled when an invite session exists', async () => {
    render(<InviteCompleteForm />)

    const passwordInput = await screen.findByLabelText('New password')

    await waitFor(() => {
      expect(passwordInput).toBeEnabled()
    })
    expect(routerMock.replace).not.toHaveBeenCalled()
  })
})
