import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDoctorClinicId } from '@/access/utils/getDoctorClinic'

const createPayload = () =>
  ({
    findByID: vi.fn(),
    logger: {
      error: vi.fn(),
    },
  }) as unknown as Payload

describe('getDoctorClinicId', () => {
  it('returns null when doctor id or payload is missing', async () => {
    await expect(getDoctorClinicId(null, createPayload())).resolves.toBeNull()
    await expect(getDoctorClinicId(1, undefined)).resolves.toBeNull()
  })

  it('returns the clinic id when the doctor stores a primitive relation', async () => {
    const payload = createPayload()
    vi.mocked(payload.findByID).mockResolvedValue({ id: 1, clinic: 17 } as never)

    await expect(getDoctorClinicId(1, payload)).resolves.toBe('17')
    expect(payload.findByID).toHaveBeenCalledWith({
      collection: 'doctors',
      id: 1,
      depth: 0,
    })
  })

  it('returns the nested clinic id when the relation is expanded', async () => {
    const payload = createPayload()
    vi.mocked(payload.findByID).mockResolvedValue({ id: 2, clinic: { id: 22 } } as never)

    await expect(getDoctorClinicId(2, payload)).resolves.toBe('22')
  })

  it('returns null when the doctor has no clinic assignment', async () => {
    const payload = createPayload()
    vi.mocked(payload.findByID).mockResolvedValue({ id: 3, clinic: null } as never)

    await expect(getDoctorClinicId(3, payload)).resolves.toBeNull()
  })

  it('logs and returns null when doctor lookup fails', async () => {
    const payload = createPayload()
    const error = new Error('lookup failed')
    vi.mocked(payload.findByID).mockRejectedValue(error)

    await expect(getDoctorClinicId(4, payload)).resolves.toBeNull()
    expect(payload.logger.error).toHaveBeenCalledWith(error, 'Error resolving doctor clinic for media access')
  })
})
