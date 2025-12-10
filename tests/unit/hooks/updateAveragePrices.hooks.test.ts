import { describe, it, expect, vi } from 'vitest'
import { updateAveragePriceAfterChange } from '@/collections/ClinicTreatments/hooks/updateAveragePriceAfterChange'
import { updateAveragePriceAfterDelete } from '@/collections/ClinicTreatments/hooks/updateAveragePriceAfterDelete'
import type { SanitizedCollectionConfig, PayloadRequest } from 'payload'
import type { Clinictreatment } from '@/payload-types'

describe('ClinicTreatments hooks (unit)', () => {
  const mockCollection = { slug: 'clinicTreatments' } as unknown as SanitizedCollectionConfig

  const makeDoc = (id: number, treatment: number): Clinictreatment => ({
    id,
    treatment,
    clinic: 1,
    price: 0,
    createdAt: '2023-01-01',
    updatedAt: '2023-01-02',
  })

  it('afterChange includes zero prices when calculating average', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: 0 }, { price: 100 }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterChange({
      doc: makeDoc(1, 1),
      req: { payload, context: {} } as unknown as PayloadRequest,
      context: {},
      data: {},
      operation: 'update',
      previousDoc: makeDoc(1, 1),
      collection: mockCollection,
    })

    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ data: { averagePrice: 50 } }))
  })

  it('afterChange excludes negative, NaN and non-number prices', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: -10 }, { price: NaN }, { price: '100' }, { price: 200 }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterChange({
      doc: makeDoc(2, 2),
      req: { payload, context: {} } as unknown as PayloadRequest,
      context: {},
      data: {},
      operation: 'update',
      previousDoc: makeDoc(2, 2),
      collection: mockCollection,
    })

    // Only 200 is valid -> average 200
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ data: { averagePrice: 200 } }))
  })

  it('afterDelete includes zero prices when calculating average', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: 0 }, { price: 100 }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterDelete({
      doc: makeDoc(3, 3),
      req: { payload, context: {} } as unknown as PayloadRequest,
      context: {},
      id: 3,
      collection: mockCollection,
    })

    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ data: { averagePrice: 50 } }))
  })

  it('afterDelete excludes invalid prices and returns null when none valid', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: null }, { price: -5 }, { price: 'x' }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterDelete({
      doc: makeDoc(4, 4),
      req: { payload, context: {} } as unknown as PayloadRequest,
      context: {},
      id: 4,
      collection: mockCollection,
    })

    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ data: { averagePrice: null } }))
  })
})
