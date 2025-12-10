import { describe, it, expect, vi, beforeEach } from 'vitest'
import { patientSupabaseCreateHook } from '@/collections/Patients/hooks/patientSupabaseCreate'
import { patientSupabaseDeleteHook } from '@/collections/Patients/hooks/patientSupabaseDelete'
import { inviteSupabaseAccount, deleteSupabaseAccount } from '@/auth/utilities/supabaseProvision'
import type { Payload, PayloadRequest, RequestContext, SanitizedCollectionConfig } from 'payload'
import type { Patient } from '@/payload-types'

const getMocks = () => {
  const payload = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    findByID: vi.fn(),
  } as unknown as Payload
  const req = { payload, context: {} } as unknown as PayloadRequest
  return { req, payload }
}

const mockCollection = { slug: 'patients' } as unknown as SanitizedCollectionConfig
const emptyContext = {} as unknown as RequestContext

describe('patientSupabaseCreateHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns data unchanged on non-create operations', async () => {
    const { req } = getMocks()
    const data = { email: 'p@test.com' }
    const result = await patientSupabaseCreateHook({
      data,
      operation: 'update',
      req,
      collection: mockCollection,
      context: emptyContext,
      originalDoc: undefined,
    })
    expect(result).toBe(data)
  })

  it('skips creation when supabaseUserId already present', async () => {
    const { req } = getMocks()
    const data = { email: 'p@test.com', supabaseUserId: 'existing' }
    const result = await patientSupabaseCreateHook({
      data,
      operation: 'create',
      req,
      collection: mockCollection,
      context: emptyContext,
      originalDoc: undefined,
    })
    expect(result).toBe(data)
  })

  it('invites Supabase user with metadata from context when provided', async () => {
    const { req } = getMocks()
    req.context = { userMetadata: { firstName: 'Ctx', lastName: 'User' } }
    const data = { email: 'p@test.com', firstName: 'P', lastName: 'T' }

    const result = await patientSupabaseCreateHook({
      data,
      operation: 'create',
      req,
      collection: mockCollection,
      context: emptyContext,
      originalDoc: undefined,
    })

    expect(inviteSupabaseAccount).toHaveBeenCalledWith({
      email: 'p@test.com',
      userType: 'patient',
      userMetadata: { firstName: 'Ctx', lastName: 'User' },
    })
    expect((result as { supabaseUserId?: string }).supabaseUserId).toBe('sb-unit-1')
  })

  it('falls back to document metadata when context metadata missing', async () => {
    const { req } = getMocks()
    const data = { email: 'p@test.com', firstName: 'P', lastName: 'T' }

    const result = await patientSupabaseCreateHook({
      data,
      operation: 'create',
      req,
      collection: mockCollection,
      context: emptyContext,
      originalDoc: undefined,
    })

    expect(inviteSupabaseAccount).toHaveBeenCalledWith({
      email: 'p@test.com',
      userType: 'patient',
      userMetadata: { firstName: 'P', lastName: 'T' },
    })
    expect((result as { supabaseUserId?: string }).supabaseUserId).toBe('sb-unit-1')
  })
})

describe('patientSupabaseDeleteHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('warns when no supabaseUserId exists', async () => {
    const { req, payload } = getMocks()
    vi.mocked(payload.findByID).mockResolvedValue({
      id: 1,
      email: 'p@test.com',
      firstName: 'P',
      lastName: 'T',
      supabaseUserId: undefined,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-02',
    } as Patient)

    await patientSupabaseDeleteHook({ req, id: '1', collection: mockCollection, context: emptyContext })

    expect(payload.logger.warn).toHaveBeenCalled()
  })

  it('deletes supabase user when supabaseUserId exists', async () => {
    const { req, payload } = getMocks()
    vi.mocked(payload.findByID).mockResolvedValue({
      id: 1,
      email: 'p@test.com',
      firstName: 'P',
      lastName: 'T',
      supabaseUserId: 'sb-unit-1',
      createdAt: '2023-01-01',
      updatedAt: '2023-01-02',
    } as Patient)

    await patientSupabaseDeleteHook({ req, id: '1', collection: mockCollection, context: emptyContext })

    expect(deleteSupabaseAccount).toHaveBeenCalledWith('sb-unit-1')
    expect(payload.logger.info).toHaveBeenCalled()
  })
})
