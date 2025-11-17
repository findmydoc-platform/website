import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensurePatientOnAuth } from '@/hooks/ensurePatientOnAuth'

const baseAuthData = {
  supabaseUserId: 'sb-user-1',
  userEmail: 'patient@example.com',
  userType: 'patient' as const,
  firstName: 'Pat',
  lastName: 'Ient',
}

const buildPayload = () => ({
  find: vi.fn(),
  create: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
})

describe('ensurePatientOnAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns existing patient when already provisioned', async () => {
    const payload = buildPayload()
    const existing = { id: 'patient-1', supabaseUserId: 'sb-user-1' }
    payload.find.mockResolvedValue({ docs: [existing] })

    const result = await ensurePatientOnAuth({ payload, authData: baseAuthData, req: undefined as any })

    expect(result).toBe(existing)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('creates a patient when none exist', async () => {
    const payload = buildPayload()
    const created = { id: 'patient-2', supabaseUserId: 'sb-user-1' }
    payload.find.mockResolvedValue({ docs: [] })
    payload.create.mockResolvedValue(created)

    const result = await ensurePatientOnAuth({ payload, authData: baseAuthData, req: undefined as any })

    expect(payload.create).toHaveBeenCalledWith({
      collection: 'patients',
      data: {
        supabaseUserId: 'sb-user-1',
        email: 'patient@example.com',
        firstName: 'Pat',
        lastName: 'Ient',
      },
      req: undefined,
      overrideAccess: true,
    })
    expect(payload.logger.info).toHaveBeenCalled()
    expect(result).toBe(created)
  })

  it('logs and rethrows when provisioning fails', async () => {
    const payload = buildPayload()
    const error = new Error('db offline')
    payload.find.mockRejectedValue(error)

    await expect(ensurePatientOnAuth({ payload, authData: baseAuthData, req: undefined as any })).rejects.toThrow(
      'db offline',
    )
    expect(payload.logger.error).toHaveBeenCalledWith(
      { supabaseUserId: 'sb-user-1', error: 'db offline' },
      'Failed to provision patient during authentication',
    )
  })
})
