import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import { getServerLogger } from '@/utilities/logging/serverLogger'

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/utilities/logging/serverLogger', () => ({
  getServerLogger: vi.fn(),
}))

const logger = {
  debug: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  info: vi.fn(),
  level: 'info',
  trace: vi.fn(),
  warn: vi.fn(),
}

describe('registration utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerLogger).mockResolvedValue(logger)
  })

  it('logs client initialization failures before creating a Supabase user', async () => {
    vi.mocked(createAdminClient).mockRejectedValueOnce(new Error('missing service role key'))

    const { createSupabaseUser } = await import('@/auth/utilities/registration')

    await expect(
      createSupabaseUser({
        email: 'ops@example.com',
        password: 'dummy-password',
        user_metadata: {},
        app_metadata: {},
        email_confirm: true,
      }),
    ).rejects.toThrow('missing service role key')

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        emailHash: expect.any(String),
        event: 'auth.supabase.admin.client_init_failed',
        operation: 'create_user',
      }),
      'Failed to initialize Supabase admin client',
    )
  })

  it('logs client initialization failures before validating first-admin creation', async () => {
    vi.mocked(createAdminClient).mockRejectedValueOnce(new Error('supabase misconfigured'))

    const { validateFirstAdminCreation } = await import('@/auth/utilities/registration')

    await expect(validateFirstAdminCreation()).rejects.toThrow('supabase misconfigured')

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.supabase.admin.client_init_failed',
        operation: 'list_users',
      }),
      'Failed to initialize Supabase admin client',
    )
  })
})
