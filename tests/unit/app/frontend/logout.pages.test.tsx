// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AdminLogoutPage from '@/app/(frontend)/admin/logout/page'
import PublicLogoutPage from '@/app/(frontend)/logout/page'

const mocks = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  resetIdentityMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mocks.replaceMock,
  }),
}))

vi.mock('@/auth/utilities/supaBaseClient', () => ({
  createClient: () => ({
    auth: {
      signOut: mocks.signOutMock,
    },
  }),
}))

vi.mock('@/posthog/client-api', () => ({
  resetPostHogBrowserIdentity: mocks.resetIdentityMock,
}))

const finishLogout = async () => {
  await act(async () => {
    await Promise.resolve()
    await vi.runAllTimersAsync()
  })
}

describe('frontend logout pages', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.signOutMock.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['admin', AdminLogoutPage, '/next/exit-preview?redirect=%2Fadmin%2Flogin'],
    ['patient', PublicLogoutPage, '/next/exit-preview?redirect=%2Flogin%2Fpatient'],
  ] as const)('clears draft mode through the exit-preview route after %s logout', async (_label, Page, path) => {
    render(<Page />)

    await finishLogout()

    expect(mocks.signOutMock).toHaveBeenCalledOnce()
    expect(mocks.resetIdentityMock).toHaveBeenCalledOnce()
    expect(mocks.replaceMock).toHaveBeenCalledWith(path)
  })

  it('still clears draft mode when Supabase logout fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.signOutMock.mockRejectedValue(new Error('logout failed'))

    render(<AdminLogoutPage />)
    await finishLogout()

    expect(mocks.resetIdentityMock).toHaveBeenCalledOnce()
    expect(mocks.replaceMock).toHaveBeenCalledWith('/next/exit-preview?redirect=%2Fadmin%2Flogin')

    consoleError.mockRestore()
  })
})
