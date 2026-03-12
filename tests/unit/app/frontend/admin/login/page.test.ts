import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY } from '@/features/previewGuard'
import type { BasicUser } from '@/payload-types'

// Ensure React is available globally for JSX emitted during tests
;(globalThis as unknown as { React: typeof React }).React = React

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const mockHeaders = vi.hoisted(() => ({
  headers: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mockHeaders.headers,
}))

// Importing `@payload-config` executes `buildConfig()` in `src/payload.config.ts`.
// Unit tests for frontend pages should not build Payload config / touch DB.
vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn().mockResolvedValue({} as unknown),
  }
})

vi.mock('@/auth/utilities/firstAdminCheck', () => ({
  hasAdminUsers: vi.fn(),
}))

vi.mock('@/auth/utilities/jwtValidation', () => ({
  extractSupabaseUserData: vi.fn(),
}))

vi.mock('@/auth/utilities/userLookup', () => ({
  findUserBySupabaseId: vi.fn().mockResolvedValue(null),
  isClinicUserApproved: vi.fn().mockResolvedValue(true),
}))

describe('Admin LoginPage', () => {
  const originalEnv = process.env

  type LoginPageElement = React.ReactElement<{
    className: string
    children: React.ReactNode
  }>
  type LoginRootElement = React.ReactElement<{ children: React.ReactNode; redirectPath: string }>
  type LogoElement = React.ReactElement<{ className?: string; showPreviewBadge?: boolean }>

  const makeStaffUser = (overrides: Partial<BasicUser>): BasicUser => ({
    id: overrides.id ?? 1,
    collection: overrides.collection ?? 'basicUsers',
    email: overrides.email ?? 'staff@example.com',
    firstName: overrides.firstName ?? 'Staff',
    lastName: overrides.lastName ?? 'User',
    userType: overrides.userType ?? 'clinic',
    createdAt: overrides.createdAt ?? '2023-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2023-01-01T00:00:00.000Z',
    supabaseUserId: overrides.supabaseUserId,
    profileImage: overrides.profileImage,
  })

  const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

  const isLoginRootElement = (value: React.ReactNode): value is LoginRootElement => {
    if (!React.isValidElement(value)) return false
    if (!isObjectRecord(value.props)) return false
    return typeof value.props.redirectPath === 'string'
  }

  const isLogoElement = (value: React.ReactNode): value is LogoElement => {
    if (!React.isValidElement(value)) return false
    if (!isObjectRecord(value.props)) return false
    return typeof value.props.className === 'string' && value.props.className.includes('h-16')
  }

  const getLoginRootElement = (pageElement: LoginPageElement): LoginRootElement => {
    const pageChildren = React.Children.toArray(pageElement.props.children)
    const loginRoot = pageChildren.find(isLoginRootElement)

    if (!loginRoot) {
      throw new Error('Expected LoginForm.Root element in LoginPage output.')
    }

    return loginRoot
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.headers.mockResolvedValue(new Headers())
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENV: undefined,
      PREVIEW_GUARD_ENABLED: 'false',
      VERCEL_ENV: undefined,
      NODE_ENV: 'test',
    }
  })

  afterEach(() => {
    process.env = originalEnv
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
    const { findUserBySupabaseId, isClinicUserApproved } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(findUserBySupabaseId).mockResolvedValue(
      makeStaffUser({
        id: 1,
        userType: 'clinic',
      }),
    )
    vi.mocked(isClinicUserApproved).mockResolvedValue(true)
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
    const { findUserBySupabaseId } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(findUserBySupabaseId).mockResolvedValue(
      makeStaffUser({
        id: 2,
        userType: 'platform',
        email: 'platform@example.com',
      }),
    )
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

  it('shows provisioning warning instead of redirect loop when payload account is missing', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { findUserBySupabaseId } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(findUserBySupabaseId).mockResolvedValue(null)
    vi.mocked(extractSupabaseUserData).mockResolvedValue({
      supabaseUserId: 'user-2',
      userEmail: 'platform@example.com',
      userType: 'platform',
      firstName: 'Platform',
      lastName: 'User',
    })

    const result = await LoginPage()
    const pageElement = result as LoginPageElement
    const rootElement = getLoginRootElement(pageElement)
    const rootChildren = React.Children.toArray(rootElement.props.children) as React.ReactElement<{
      message?: string
    }>[]
    const statusElement = rootChildren[1]

    expect(redirect).not.toHaveBeenCalled()
    expect(statusElement?.props.message).toBe(
      'Your Supabase session is active, but no admin account could be found in the CMS. Please contact support.',
    )
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

  it('shows preview-required message from search params', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue(null)

    const result = await LoginPage({
      searchParams: Promise.resolve({
        message: PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY,
        next: '/posts/example',
      }),
    })

    const pageElement = result as LoginPageElement
    const rootElement = getLoginRootElement(pageElement)
    const rootChildren = React.Children.toArray(rootElement.props.children) as React.ReactElement<{
      message?: string
    }>[]
    const statusElement = rootChildren[1]

    expect(statusElement?.props.message).toBe('This is a preview deployment. Please sign in to continue.')
    expect(rootElement.props.redirectPath).toBe('/posts/example')
  })

  it('falls back to /admin when next param is unsafe', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const LoginPage = await getPageModule()

    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue(null)

    const result = await LoginPage({
      searchParams: Promise.resolve({
        next: 'https://evil.example.com',
      }),
    })

    const pageElement = result as LoginPageElement
    const rootElement = getLoginRootElement(pageElement)
    expect(rootElement.props.redirectPath).toBe('/admin')
  })

  it('renders preview badge on login logo in preview environment', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const LoginPage = await getPageModule()

    process.env.DEPLOYMENT_ENV = 'preview'
    process.env.PREVIEW_GUARD_ENABLED = 'true'
    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue(null)

    const result = await LoginPage({
      searchParams: Promise.resolve({
        message: PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY,
      }),
    })
    const pageElement = result as LoginPageElement
    const pageChildren = React.Children.toArray(pageElement.props.children)
    const logoElement = pageChildren.find(isLogoElement)

    expect(logoElement).toBeTruthy()
    expect(logoElement?.props.showPreviewBadge).toBe(true)
  })

  it('does not redirect clinic users when preview guard is enabled', async () => {
    const { hasAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    process.env.DEPLOYMENT_ENV = 'preview'
    process.env.PREVIEW_GUARD_ENABLED = 'true'
    vi.mocked(hasAdminUsers).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue({
      supabaseUserId: 'clinic-user',
      userEmail: 'clinic@example.com',
      userType: 'clinic',
      firstName: 'Clinic',
      lastName: 'User',
    })

    const result = await LoginPage()
    const pageElement = result as LoginPageElement
    const rootElement = getLoginRootElement(pageElement)
    const rootChildren = React.Children.toArray(rootElement.props.children) as React.ReactElement<{
      message?: string
    }>[]
    const statusElement = rootChildren[1]

    expect(redirect).not.toHaveBeenCalled()
    expect(statusElement?.props.message).toBe('This preview deployment is restricted to platform staff accounts.')
  })
})
