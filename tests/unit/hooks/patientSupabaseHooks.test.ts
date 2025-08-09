import { describe, it, expect, vi, beforeEach } from 'vitest'
import { patientSupabaseCreateHook, patientSupabaseDeleteHook } from '@/hooks/userLifecycle/patientSupabaseHooks'

vi.mock('@/auth/utilities/supabaseProvision', () => ({
  createSupabaseAccount: vi.fn(async () => 'sb-unit-1'),
  deleteSupabaseAccount: vi.fn(async () => true),
}))

const getMocks = () => {
  const payload = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    findByID: vi.fn(),
  } as any
  const req = { payload, context: {} } as any
  return { req, payload }
}

describe('patientSupabaseCreateHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns data unchanged on non-create operations', async () => {
    const { req } = getMocks()
    const data = { email: 'p@test.com' } as any
    const result = await patientSupabaseCreateHook({ data, operation: 'update', req } as any)
    expect(result).toBe(data)
  })

  it('skips creation when skipSupabaseCreation flag is set', async () => {
    const { req } = getMocks()
    req.context.skipSupabaseCreation = true
    const data = { email: 'p@test.com' } as any
    const result = await patientSupabaseCreateHook({ data, operation: 'create', req } as any)
    expect(result).toBe(data)
  })

  it('throws when no password provided', async () => {
    const { req } = getMocks()
    const data = { email: 'p@test.com', firstName: 'P', lastName: 'T' } as any
    await expect(patientSupabaseCreateHook({ data, operation: 'create', req } as any)).rejects.toThrow(
      /Missing userProvidedPassword/,
    )
  })

  it('creates supabase user using initialPassword and strips it from data', async () => {
    const { req } = getMocks()
    const data = { email: 'p@test.com', firstName: 'P', lastName: 'T', initialPassword: 'Strong#12345' } as any

    const result = await patientSupabaseCreateHook({ data, operation: 'create', req } as any)

    expect(result.supabaseUserId).toBe('sb-unit-1')
    expect((result as any).initialPassword).toBeUndefined()
  })

  it('returns early if supabaseUserId already present', async () => {
    const { req } = getMocks()
    const data = { email: 'p@test.com', supabaseUserId: 'existing' } as any
    const result = await patientSupabaseCreateHook({ data, operation: 'create', req } as any)
    expect(result).toBe(data)
  })
})

describe('patientSupabaseDeleteHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('warns when no supabaseUserId exists', async () => {
    const { req, payload } = getMocks()
    payload.findByID.mockResolvedValue({ id: '1', supabaseUserId: undefined })

    await patientSupabaseDeleteHook({ req, id: '1' } as any)

    expect(payload.logger.warn).toHaveBeenCalled()
  })

  it('deletes supabase user when supabaseUserId exists', async () => {
    const { req, payload } = getMocks()
    payload.findByID.mockResolvedValue({ id: '1', supabaseUserId: 'sb-unit-1' })

    await patientSupabaseDeleteHook({ req, id: '1' } as any)

    expect(payload.logger.info).toHaveBeenCalled()
  })
})
