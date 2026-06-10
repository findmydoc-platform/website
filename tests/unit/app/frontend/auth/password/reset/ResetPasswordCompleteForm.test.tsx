// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTH_FLASH_STORAGE_KEY } from '@/auth/utilities/authFlash'
import { ResetPasswordCompleteForm } from '@/app/(frontend)/auth/password/reset/complete/ResetPasswordCompleteForm'

const resetPassword = 'RecoveredPass123' // pragma: allowlist secret

const routerMock = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}))

const supabaseAuthMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}))

const resetPostHogBrowserIdentityMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}))

vi.mock('@/auth/utilities/supaBaseClient', () => ({
  createClient: () => ({
    auth: supabaseAuthMock,
  }),
}))

vi.mock('@/posthog/client-api', () => ({
  resetPostHogBrowserIdentity: resetPostHogBrowserIdentityMock,
}))

const mockRecoverySession = (userType: unknown) => {
  supabaseAuthMock.getSession.mockResolvedValue({
    data: {
      session: {
        user: {
          app_metadata: {
            user_type: userType,
          },
        },
      },
    },
  })
}

async function submitResetForm() {
  render(<ResetPasswordCompleteForm />)

  const passwordInput = await screen.findByLabelText('New password')
  const confirmPasswordInput = screen.getByLabelText('Confirm password')

  await waitFor(() => {
    expect(passwordInput).toBeEnabled()
  })

  fireEvent.change(passwordInput, { target: { value: resetPassword } })
  fireEvent.change(confirmPasswordInput, { target: { value: resetPassword } })
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
}

describe('ResetPasswordCompleteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    mockRecoverySession('patient')
    supabaseAuthMock.updateUser.mockResolvedValue({ error: null })
    supabaseAuthMock.signOut.mockResolvedValue({ error: null })
  })

  it.each([
    ['patient', '/login/patient'],
    ['clinic', '/admin/login'],
    ['platform', '/admin/login'],
  ] as const)('redirects %s users to the correct login page after updating the password', async (userType, href) => {
    mockRecoverySession(userType)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    await submitResetForm()

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(href)
    })

    expect(supabaseAuthMock.updateUser).toHaveBeenCalledWith({ password: resetPassword })
    expect(supabaseAuthMock.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(resetPostHogBrowserIdentityMock).toHaveBeenCalled()
    expect(routerMock.refresh).toHaveBeenCalled()

    const rawFlash = window.sessionStorage.getItem(AUTH_FLASH_STORAGE_KEY)
    expect(rawFlash).not.toBeNull()
    expect(JSON.parse(rawFlash ?? '{}')).toMatchObject({
      kind: 'password-reset-complete',
    })

    const updateUserCallOrder = supabaseAuthMock.updateUser.mock.invocationCallOrder[0]
    const signOutCallOrder = supabaseAuthMock.signOut.mock.invocationCallOrder[0]
    const flashWriteCallOrder = setItemSpy.mock.invocationCallOrder[0]
    const redirectCallOrder = routerMock.replace.mock.invocationCallOrder[0]

    expect(updateUserCallOrder).toEqual(expect.any(Number))
    expect(signOutCallOrder).toEqual(expect.any(Number))
    expect(flashWriteCallOrder).toEqual(expect.any(Number))
    expect(redirectCallOrder).toEqual(expect.any(Number))

    expect(updateUserCallOrder!).toBeLessThan(signOutCallOrder!)
    expect(signOutCallOrder!).toBeLessThan(flashWriteCallOrder!)
    expect(flashWriteCallOrder!).toBeLessThan(redirectCallOrder!)

    setItemSpy.mockRestore()
  })

  it('shows a session error when the recovery link did not create a session', async () => {
    supabaseAuthMock.getSession.mockResolvedValue({ data: { session: null } })

    render(<ResetPasswordCompleteForm />)

    expect(await screen.findByText('No active session. Please request a new password reset link.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update password' })).toBeDisabled()
  })

  it('does not show a success flash when only local sign-out succeeds after global sign-out fails', async () => {
    supabaseAuthMock.signOut
      .mockResolvedValueOnce({ error: { message: 'global sign-out failed' } })
      .mockResolvedValueOnce({ error: null })

    await submitResetForm()

    await waitFor(() => {
      expect(screen.getByText(/Password updated, but we could not sign out all active sessions/)).toBeInTheDocument()
    })

    expect(supabaseAuthMock.signOut).toHaveBeenNthCalledWith(1, { scope: 'global' })
    expect(supabaseAuthMock.signOut).toHaveBeenNthCalledWith(2, { scope: 'local' })
    expect(resetPostHogBrowserIdentityMock).toHaveBeenCalled()
    expect(routerMock.replace).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(AUTH_FLASH_STORAGE_KEY)).toBeNull()
    expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute('href', '/login/patient')
  })
})
