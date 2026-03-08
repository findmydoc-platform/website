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

describe('supabase logging helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerLogger).mockResolvedValue(logger)
  })

  it('creates scoped auth loggers from the shared server logger', async () => {
    const { getSupabaseLogger } = await import('@/auth/utilities/supabaseLogger')

    const scopedLogger = await getSupabaseLogger({
      bindings: {
        component: 'password-reset',
      },
    })

    scopedLogger.warn(
      {
        event: 'auth.supabase.password_reset.rejected',
      },
      'Password reset request was rejected by Supabase',
    )

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'password-reset',
        event: 'auth.supabase.password_reset.rejected',
        scope: 'auth.supabase',
      }),
      'Password reset request was rejected by Supabase',
    )
  })

  it('logs structured metadata when the Supabase admin client cannot be initialized', async () => {
    vi.mocked(createAdminClient).mockRejectedValueOnce(new Error('missing service role key'))

    const { getLoggedSupabaseAdminClient } = await import('@/auth/utilities/supabaseLogger')

    await expect(
      getLoggedSupabaseAdminClient({
        component: 'supabase-admin',
        meta: {
          operation: 'create_user',
        },
      }),
    ).rejects.toThrow('missing service role key')

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'supabase-admin',
        event: 'auth.supabase.admin.client_init_failed',
        operation: 'create_user',
        scope: 'auth.supabase',
      }),
      'Failed to initialize Supabase admin client',
    )
  })
})
