import { describe, it, expect, vi, beforeEach } from 'vitest'
import { patientSupabaseCreateHook, patientSupabaseDeleteHook } from '@/hooks/userLifecycle/patientSupabaseHooks'

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


  it('creates even when no password provided (current implementation allows undefined)', async () => {
    const { req } = getMocks()
    const data = { email: 'p@test.com', firstName: 'P', lastName: 'T' } as any
    const result = await patientSupabaseCreateHook({ data, operation: 'create', req } as any)
    expect(result.supabaseUserId).toBe('sb-unit-1')
  })

  it('creates supabase user using context.password (not persisted)', async () => {
    const { req } = getMocks()
    req.context.password = 'Strong#12345'
    // password is NOT placed on data; it should only come from context and not persist
    const data = { email: 'p@test.com', firstName: 'P', lastName: 'T' } as any

    const result = await patientSupabaseCreateHook({ data, operation: 'create', req } as any)

    expect(result.supabaseUserId).toBe('sb-unit-1')
    expect((result as any).password).toBeUndefined()
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
