import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Ensure React is available globally for JSX emitted during tests
;(globalThis as any).React = React

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/auth/utilities/firstAdminCheck', () => ({
  hasAdminUsers: vi.fn(),
}))

vi.mock('@/auth/utilities/jwtValidation', () => ({
  extractSupabaseUserData: vi.fn(),
}))

describe('Admin LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  const getPageModule = async () => {
    const pageModule = await import('@/app/(frontend)/admin/login/page')
    return pageModule.default
  }

  it('redirects to first-admin when no admin users exist', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(false)

    await LoginPage()

    expect(redirect).toHaveBeenCalledWith('first-admin')
  })

  it('redirects to admin when a clinic session is active', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue({
      supabaseUserId: 'user-1',
      userEmail: 'staff@example.com',
      userType: 'clinic',
      firstName: 'Clinic',
      lastName: 'User',
    })

    await LoginPage()

    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  it('redirects to admin when a platform session is active', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue({
      supabaseUserId: 'user-2',
      userEmail: 'platform@example.com',
      userType: 'platform',
      firstName: 'Platform',
      lastName: 'User',
    })

    await LoginPage()

    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  it('does not redirect when a patient session is active', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue({
      supabaseUserId: 'patient-1',
      userEmail: 'patient@example.com',
      userType: 'patient',
      firstName: 'Patient',
      lastName: 'User',
    })

    const result = await LoginPage()

    expect(redirect).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
  })

  it('renders the login form when no session is active', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue(null)

    const result = await LoginPage()

    expect(redirect).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
    expect(result.props.className).toContain('flex')
  })
})
