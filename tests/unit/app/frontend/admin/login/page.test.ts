import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PREVIEW_GUARD_LOCK_REQUEST_HEADER, PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY } from '@/features/previewGuard'
import { TEMPORARY_LANDING_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'
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

const payloadLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  info: vi.fn(),
  level: 'info',
  trace: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn().mockResolvedValue({ logger: payloadLoggerMock } as unknown),
  }
})

vi.mock('@/auth/utilities/firstAdminCheck', () => ({
  hasLocalAdminUsers: vi.fn(),
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

  it('keeps login visible and logs a warning when no local admins exist', async () => {
    const { hasLocalAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    process.env.DEPLOYMENT_ENV = 'development'
    vi.mocked(extractSupabaseUserData).mockResolvedValue(null)
    vi.mocked(hasLocalAdminUsers).mockResolvedValue(false)

    const result = await LoginPage()
    const pageElement = result as LoginPageElement
    const rootElement = getLoginRootElement(pageElement)
    const rootChildren = React.Children.toArray(rootElement.props.children) as React.ReactElement<{
      message?: string
      variant?: string
    }>[]
    const statusElement = rootChildren[1]

    expect(redirect).not.toHaveBeenCalled()
    expect(statusElement?.props.message).toBeUndefined()
    expect(statusElement?.props.variant).toBeUndefined()
    expect(payloadLoggerMock.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'admin-login',
        event: 'auth.admin_login.no_platform_admins',
        scope: 'auth.admin_login',
      }),
      'No platform admin account exists; provision through ops workflow',
    )
  })

  it('keeps the login form available in test runtime when payload admins are absent', async () => {
    const { hasLocalAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(extractSupabaseUserData).mockResolvedValue(null)
    vi.mocked(hasLocalAdminUsers).mockResolvedValue(false)

    const result = await LoginPage()

    expect(redirect).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
  })

  it('redirects to admin when a clinic session is active', async () => {
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { findUserBySupabaseId, isClinicUserApproved } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

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

    expect(findUserBySupabaseId).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ supabaseUserId: 'user-1', userType: 'clinic' }),
      undefined,
      undefined,
      { allowEmailReconcile: false },
    )
    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  it('redirects to admin when a platform session is active', async () => {
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { findUserBySupabaseId } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

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

    expect(findUserBySupabaseId).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ supabaseUserId: 'user-2', userType: 'platform' }),
      undefined,
      undefined,
      { allowEmailReconcile: false },
    )
    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  it('enables out-of-sync reconcile for platform sessions in preview runtime', async () => {
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { findUserBySupabaseId } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    process.env.DEPLOYMENT_ENV = 'preview'
    vi.mocked(findUserBySupabaseId).mockResolvedValue(
      makeStaffUser({
        id: 22,
        userType: 'platform',
        email: 'platform@example.com',
        supabaseUserId: 'user-22',
      }),
    )
    vi.mocked(extractSupabaseUserData).mockResolvedValue({
      supabaseUserId: 'user-22',
      userEmail: 'platform@example.com',
      userType: 'platform',
      firstName: 'Platform',
      lastName: 'Recovered',
    })

    await LoginPage()

    expect(findUserBySupabaseId).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ supabaseUserId: 'user-22', userType: 'platform' }),
      undefined,
      undefined,
      { allowEmailReconcile: true },
    )
    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  it('does not redirect when a patient session is active', async () => {
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

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

  it('shows provisioning warning in non-preview runtime when payload account is missing', async () => {
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { findUserBySupabaseId } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

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

  it('redirects platform sessions without cms account to /admin in preview runtime', async () => {
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { findUserBySupabaseId } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    process.env.DEPLOYMENT_ENV = 'preview'
    vi.mocked(findUserBySupabaseId).mockResolvedValue(null)
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

  it('renders the login form when no session is active', async () => {
    const { hasLocalAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    vi.mocked(hasLocalAdminUsers).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue(null)

    const result = await LoginPage()

    expect(redirect).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
    expect(result.props.className).toContain('flex')
  })

  it('shows preview-required message from search params', async () => {
    const { hasLocalAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const LoginPage = await getPageModule()

    vi.mocked(hasLocalAdminUsers).mockResolvedValue(true)
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
    const { hasLocalAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const LoginPage = await getPageModule()

    vi.mocked(hasLocalAdminUsers).mockResolvedValue(true)
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
    const { hasLocalAdminUsers } = await import('@/auth/utilities/firstAdminCheck')
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const LoginPage = await getPageModule()

    process.env.DEPLOYMENT_ENV = 'preview'
    vi.mocked(hasLocalAdminUsers).mockResolvedValue(true)
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

  it('redirects approved clinic users in preview runtime when preview guard is disabled', async () => {
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { findUserBySupabaseId, isClinicUserApproved } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    process.env.DEPLOYMENT_ENV = 'preview'
    vi.mocked(findUserBySupabaseId).mockResolvedValue(
      makeStaffUser({
        id: 3,
        userType: 'clinic',
      }),
    )
    vi.mocked(isClinicUserApproved).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue({
      supabaseUserId: 'clinic-user',
      userEmail: 'clinic@example.com',
      userType: 'clinic',
      firstName: 'Clinic',
      lastName: 'User',
    })

    await LoginPage()

    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  it('blocks clinic sessions when preview guard lock header is present', async () => {
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { findUserBySupabaseId, isClinicUserApproved } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    mockHeaders.headers.mockResolvedValue(new Headers({ [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: '1' }))
    vi.mocked(findUserBySupabaseId).mockResolvedValue(
      makeStaffUser({
        id: 4,
        userType: 'clinic',
      }),
    )
    vi.mocked(isClinicUserApproved).mockResolvedValue(true)
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

  it('does not treat a temporary landing-only lock as preview guard login restriction', async () => {
    const { extractSupabaseUserData } = await import('@/auth/utilities/jwtValidation')
    const { findUserBySupabaseId, isClinicUserApproved } = await import('@/auth/utilities/userLookup')
    const { redirect } = await import('next/navigation')
    const LoginPage = await getPageModule()

    mockHeaders.headers.mockResolvedValue(
      new Headers({
        [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: '1',
        [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1',
      }),
    )
    vi.mocked(findUserBySupabaseId).mockResolvedValue(
      makeStaffUser({
        id: 5,
        userType: 'clinic',
      }),
    )
    vi.mocked(isClinicUserApproved).mockResolvedValue(true)
    vi.mocked(extractSupabaseUserData).mockResolvedValue({
      supabaseUserId: 'clinic-user',
      userEmail: 'clinic@example.com',
      userType: 'clinic',
      firstName: 'Clinic',
      lastName: 'User',
    })

    await LoginPage()

    expect(redirect).toHaveBeenCalledWith('/admin')
  })
})
