import { describe, it, expect, beforeEach, vi } from 'vitest'

const registrationMock = vi.hoisted(() => ({
  createSupabaseUser: vi.fn(),
  createSupabaseUserConfig: vi.fn(),
  createSupabaseInviteConfig: vi.fn(),
}))

const adminClient = vi.hoisted(() => ({
  auth: {
    admin: {
      inviteUserByEmail: vi.fn(),
      updateUserById: vi.fn(),
    },
  },
}))

vi.mock('@/auth/utilities/registration', () => registrationMock)
vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: vi.fn(async () => adminClient),
}))

vi.mock('@/payload.config', () => ({
  default: Promise.resolve({}) as unknown,
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      level: 'info',
    },
  })),
}))

const actualModulePromise = vi.importActual<typeof import('@/auth/utilities/supabaseProvision')>(
  '@/auth/utilities/supabaseProvision',
)

describe('createSupabaseAccountWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registrationMock.createSupabaseUser.mockResolvedValue({ id: 'direct-id' })
    registrationMock.createSupabaseUserConfig.mockReturnValue({ email: 'test', password: 'secret' } as unknown)
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
    expect(registrationMock.createSupabaseUser).toHaveBeenCalledWith({ email: 'test', password: 'secret' })
    expect(supabaseId).toBe('direct-id')
  })
})

describe('inviteSupabaseAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
  })
})
