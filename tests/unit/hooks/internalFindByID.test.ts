import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { findInternalByID } from '@/hooks/internalFindByID'

describe('findInternalByID', () => {
  it('threads the active request and bypasses normal access checks', async () => {
    const doc = { id: 42, title: 'Dermatology' }
    const findByID = vi.fn().mockResolvedValue(doc)
    const req = { payload: { findByID } } as unknown as PayloadRequest

    const result = await findInternalByID({
      collection: 'medical-specialties',
      id: 42,
      req,
    })

    expect(result).toBe(doc)
    expect(findByID).toHaveBeenCalledWith({
      collection: 'medical-specialties',
      id: 42,
      depth: 0,
      overrideAccess: true,
      req,
    })
  })
})
