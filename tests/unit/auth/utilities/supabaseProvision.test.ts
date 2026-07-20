import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SupabaseUserConfig } from '@/auth/utilities/registration'
import { getServerLogger } from '@/utilities/logging/serverLogger'

const registrationMock = vi.hoisted(() => ({
  createSupabaseUser: vi.fn(),
  createSupabaseUserConfig: vi.fn(),
  createSupabaseInviteConfig: vi.fn(),
}))

const adminClient = vi.hoisted(() => ({
  auth: {
    admin: {
      deleteUser: vi.fn(),
      inviteUserByEmail: vi.fn(),
      listUsers: vi.fn(),
      updateUserById: vi.fn(),
    },
  },
}))

vi.mock('@/auth/utilities/registration', () => registrationMock)
vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: vi.fn(async () => adminClient),
}))

vi.mock('@/utilities/logging/serverLogger', () => ({
  getServerLogger: vi.fn(),
}))

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  level: 'info',
}))

const actualModulePromise = vi.importActual<typeof import('@/auth/utilities/supabaseProvision')>(
  '@/auth/utilities/supabaseProvision',
)

describe('createSupabaseAccountWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerLogger).mockResolvedValue(logger)
    registrationMock.createSupabaseUser.mockResolvedValue({ id: 'direct-id' })
    const mockConfig: SupabaseUserConfig = {
      email: 'test',
      password: 'dummy-password', // pragma: allowlist secret
      user_metadata: {},
      app_metadata: {},
      email_confirm: true,
    }
    registrationMock.createSupabaseUserConfig.mockReturnValue(mockConfig)
  })

  it('creates a Supabase user directly when password is provided', async () => {
    const { createSupabaseAccountWithPassword } = await actualModulePromise

    const supabaseId = await createSupabaseAccountWithPassword({
      email: 'user@example.com',
      password: 'Strong#12345',
      userType: 'clinic',
      userMetadata: { firstName: 'Clinic', lastName: 'User' },
    })

    expect(registrationMock.createSupabaseUserConfig).toHaveBeenCalledWith(
      {
        email: 'user@example.com',
        password: 'Strong#12345',
        firstName: 'Clinic',
        lastName: 'User',
      },
      'clinic',
    )
    expect(registrationMock.createSupabaseUser).toHaveBeenCalledWith(
      {
        email: 'test',
        password: 'dummy-password', // pragma: allowlist secret
        user_metadata: {},
        app_metadata: {},
        email_confirm: true,
      },
      undefined,
    )
    expect(supabaseId).toBe('direct-id')
  })
})

describe('inviteSupabaseAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerLogger).mockResolvedValue(logger)
    registrationMock.createSupabaseInviteConfig.mockReturnValue({
      email: 'invite@example.com',
      user_metadata: { first_name: 'Invite', last_name: 'User' },
    })
    adminClient.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: 'invited-id' } },
      error: null,
    })
    adminClient.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null })
  })

  it('sends an invite and updates metadata', async () => {
    const { inviteSupabaseAccount } = await actualModulePromise

    const supabaseId = await inviteSupabaseAccount({
      email: 'invitee@example.com',
      userType: 'patient',
      userMetadata: { firstName: 'Patient', lastName: 'Example' },
    })

    expect(registrationMock.createSupabaseInviteConfig).toHaveBeenCalledWith({
      email: 'invitee@example.com',
      password: null,
      firstName: 'Patient',
      lastName: 'Example',
    })
    expect(adminClient.auth.admin.inviteUserByEmail).toHaveBeenCalledWith('invite@example.com', {
      data: { first_name: 'Invite', last_name: 'User' },
      redirectTo: 'http://localhost:3000/auth/callback?next=/auth/invite/complete',
    })
    expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith('invited-id', {
      app_metadata: { user_type: 'patient' },
    })
    expect(supabaseId).toBe('invited-id')
  })

  it('throws when Supabase invite returns an error', async () => {
    const { inviteSupabaseAccount } = await actualModulePromise

    adminClient.auth.admin.inviteUserByEmail.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invite failed' },
    })

    await expect(
      inviteSupabaseAccount({
        email: 'invitee@example.com',
        userType: 'patient',
        userMetadata: { firstName: 'Patient', lastName: 'Example' },
      }),
    ).rejects.toThrow('Supabase user invite failed: invite failed')
  })

  it('throws when invite succeeds but returns no user data', async () => {
    const { inviteSupabaseAccount } = await actualModulePromise

    adminClient.auth.admin.inviteUserByEmail.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    await expect(
      inviteSupabaseAccount({
        email: 'invitee@example.com',
        userType: 'patient',
        userMetadata: { firstName: 'Patient', lastName: 'Example' },
      }),
    ).rejects.toThrow('Supabase invite succeeded but no user data returned')
  })

  it('throws when metadata update fails after invite', async () => {
    const { inviteSupabaseAccount } = await actualModulePromise

    adminClient.auth.admin.inviteUserByEmail.mockResolvedValueOnce({
      data: { user: { id: 'invited-id' } },
      error: null,
    })
    adminClient.auth.admin.updateUserById.mockResolvedValueOnce({
      data: {},
      error: { message: 'update failed' },
    })

    await expect(
      inviteSupabaseAccount({
        email: 'invitee@example.com',
        userType: 'patient',
        userMetadata: { firstName: 'Patient', lastName: 'Example' },
      }),
    ).rejects.toThrow('Supabase invite metadata update failed: update failed')
  })

  it('propagates createAdminClient failures', async () => {
    const { inviteSupabaseAccount } = await actualModulePromise
    const { createAdminClient } = await import('@/auth/utilities/supaBaseServer')

    vi.mocked(createAdminClient).mockRejectedValueOnce(new Error('admin client down'))

    await expect(
      inviteSupabaseAccount({
        email: 'invitee@example.com',
        userType: 'patient',
        userMetadata: { firstName: 'Patient', lastName: 'Example' },
      }),
    ).rejects.toThrow('admin client down')

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.supabase.admin.client_init_failed',
        operation: 'invite_user',
        userType: 'patient',
      }),
      'Failed to initialize Supabase admin client',
    )
  })
})

describe('clinic Supabase provisioning', () => {
  const originalDashboardUrl = process.env.CLINIC_DASHBOARD_URL

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerLogger).mockResolvedValue(logger)
    process.env.CLINIC_DASHBOARD_URL = 'https://dashboard.example.com'
    adminClient.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: {
        user: {
          id: 'clinic-user-id',
          email: 'clinic@example.com',
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    })
    adminClient.auth.admin.listUsers.mockResolvedValue({ data: { users: [], nextPage: null }, error: null })
    adminClient.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null })
    adminClient.auth.admin.deleteUser.mockResolvedValue({ data: {}, error: null })
  })

  afterEach(() => {
    if (originalDashboardUrl === undefined) Reflect.deleteProperty(process.env, 'CLINIC_DASHBOARD_URL')
    else process.env.CLINIC_DASHBOARD_URL = originalDashboardUrl
  })

  it('sends clinic invites to the Dashboard and binds reconciliation metadata', async () => {
    const { inviteClinicSupabaseAccount } = await actualModulePromise

    await expect(
      inviteClinicSupabaseAccount({
        email: ' Clinic@Example.com ',
        onboardingKey: 'clinic-application:42',
        userMetadata: { firstName: 'Ada', lastName: 'Lovelace' },
      }),
    ).resolves.toBe('clinic-user-id')

    expect(adminClient.auth.admin.inviteUserByEmail).toHaveBeenCalledWith('clinic@example.com', {
      data: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        onboarding_key: 'clinic-application:42',
      },
      redirectTo: 'https://dashboard.example.com/auth/callback?next=/auth/invite/complete',
    })
    expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith('clinic-user-id', {
      app_metadata: { user_type: 'clinic' },
      user_metadata: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        onboarding_key: 'clinic-application:42',
      },
    })
  })

  it('reconciles an unknown invite result by normalized email and onboarding key', async () => {
    const { inviteClinicSupabaseAccount } = await actualModulePromise
    adminClient.auth.admin.inviteUserByEmail.mockRejectedValueOnce(new Error('connection closed'))
    adminClient.auth.admin.listUsers.mockResolvedValueOnce({
      data: {
        users: [
          {
            id: 'reconciled-id',
            email: 'CLINIC@example.com',
            app_metadata: {},
            user_metadata: { onboarding_key: 'clinic-application:42' },
          },
        ],
        nextPage: null,
      },
      error: null,
    })

    await expect(
      inviteClinicSupabaseAccount({
        email: 'clinic@example.com',
        onboardingKey: 'clinic-application:42',
      }),
    ).resolves.toBe('reconciled-id')
  })

  it('fails closed when invite reconciliation finds no matching identity', async () => {
    const { inviteClinicSupabaseAccount } = await actualModulePromise
    adminClient.auth.admin.inviteUserByEmail.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'already registered' },
    })

    await expect(
      inviteClinicSupabaseAccount({
        email: 'clinic@example.com',
        onboardingKey: 'clinic-application:42',
      }),
    ).rejects.toThrow('Supabase clinic invite failed: already registered')
  })

  it('synchronizes clinic access with explicit ban and unban durations', async () => {
    const { setClinicSupabaseAccountAccess } = await actualModulePromise

    await setClinicSupabaseAccountAccess({ enabled: false, supabaseUserId: 'clinic-user-id' })
    await setClinicSupabaseAccountAccess({ enabled: true, supabaseUserId: 'clinic-user-id' })

    expect(adminClient.auth.admin.updateUserById).toHaveBeenNthCalledWith(1, 'clinic-user-id', {
      app_metadata: { user_type: 'clinic' },
      ban_duration: '876000h',
    })
    expect(adminClient.auth.admin.updateUserById).toHaveBeenNthCalledWith(2, 'clinic-user-id', {
      app_metadata: { user_type: 'clinic' },
      ban_duration: 'none',
    })
  })

  it('treats an already missing offboarded identity as deleted', async () => {
    const { deleteClinicSupabaseAccount } = await actualModulePromise
    adminClient.auth.admin.deleteUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'User not found', status: 404 },
    })

    await expect(deleteClinicSupabaseAccount('clinic-user-id')).resolves.toBeUndefined()
  })
})
