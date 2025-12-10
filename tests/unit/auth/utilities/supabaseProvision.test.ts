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
})
