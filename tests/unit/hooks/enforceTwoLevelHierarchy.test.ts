import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { enforceTwoLevelHierarchy } from '@/collections/MedicalSpecialties/hooks/enforceTwoLevelHierarchy'

const createReq = () => {
  const payload = {
    findByID: vi.fn(),
  }

  return {
    payload,
    req: { payload } as unknown as PayloadRequest,
  }
}

describe('enforceTwoLevelHierarchy', () => {
  it('returns data unchanged when parentSpecialty was not provided', async () => {
    const { payload, req } = createReq()
    const data = { title: 'Dermatology' }

    const result = await enforceTwoLevelHierarchy({
      collection: { slug: 'medical-specialties' } as never,
      context: {},
      data,
      operation: 'update',
      originalDoc: { id: 10, parentSpecialty: 1 },
      req,
    })

    expect(result).toBe(data)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('allows clearing the parent relation without loading the current parent', async () => {
    const { payload, req } = createReq()
    const data = { parentSpecialty: null }

    const result = await enforceTwoLevelHierarchy({
      collection: { slug: 'medical-specialties' } as never,
      context: {},
      data,
      operation: 'update',
      originalDoc: { id: 10, parentSpecialty: 1 },
      req,
    })

    expect(result).toBe(data)
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('rejects self-references using the original document id fallback', async () => {
    const { req } = createReq()

    await expect(
      enforceTwoLevelHierarchy({
        collection: { slug: 'medical-specialties' } as never,
        context: {},
        data: { parentSpecialty: '42' },
        operation: 'update',
        originalDoc: { id: 42 },
        req,
      }),
    ).rejects.toThrow('A medical specialty cannot be its own parent.')
  })

  it('rejects parents that already have a parent and loads them with elevated access', async () => {
    const { payload, req } = createReq()
    payload.findByID.mockResolvedValue({ id: 50, parentSpecialty: { id: 1 } })

    await expect(
      enforceTwoLevelHierarchy({
        collection: { slug: 'medical-specialties' } as never,
        context: {},
        data: { id: 99, parentSpecialty: 50 },
        operation: 'create',
        originalDoc: undefined,
        req,
      }),
    ).rejects.toThrow(
      'Only two hierarchy levels are allowed for medical specialties. Create level 3 entries as treatments.',
    )

    expect(payload.findByID).toHaveBeenCalledWith({
      collection: 'medical-specialties',
      id: 50,
      depth: 0,
      overrideAccess: true,
      req,
    })
  })

  it('accepts a direct child of a top-level specialty', async () => {
    const { payload, req } = createReq()
    payload.findByID.mockResolvedValue({ id: 77, parentSpecialty: null })
    const data = { id: 'new-specialty', parentSpecialty: { id: 77 } }

    const result = await enforceTwoLevelHierarchy({
      collection: { slug: 'medical-specialties' } as never,
      context: {},
      data,
      operation: 'create',
      originalDoc: undefined,
      req,
    })

    expect(result).toBe(data)
  })
})
