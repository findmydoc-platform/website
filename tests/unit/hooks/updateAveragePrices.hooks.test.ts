/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { updateAveragePriceAfterChange } from '@/collections/ClinicTreatments/hooks/updateAveragePriceAfterChange'
import { updateAveragePriceAfterDelete } from '@/collections/ClinicTreatments/hooks/updateAveragePriceAfterDelete'

describe('ClinicTreatments hooks (unit)', () => {
  it('afterChange includes zero prices when calculating average', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: 0 }, { price: 100 }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterChange({
      doc: { id: 'ct-1', treatment: 't-1' },
      req: { payload, context: {} },
    } as any)

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { averagePrice: 50 } }),
    )
  })

  it('afterChange excludes negative, NaN and non-number prices', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: -10 }, { price: NaN }, { price: '100' }, { price: 200 }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterChange({
      doc: { id: 'ct-2', treatment: 't-2' },
      req: { payload, context: {} },
    } as any)

    // Only 200 is valid -> average 200
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { averagePrice: 200 } }),
    )
  })

  it('afterDelete includes zero prices when calculating average', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: 0 }, { price: 100 }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterDelete({
      doc: { id: 'ct-3', treatment: 't-3' },
      req: { payload, context: {} },
    } as any)

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { averagePrice: 50 } }),
    )
  })

  it('afterDelete excludes invalid prices and returns null when none valid', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: null }, { price: -5 }, { price: 'x' }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterDelete({
      doc: { id: 'ct-4', treatment: 't-4' },
      req: { payload, context: {} },
    } as any)

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { averagePrice: null } }),
    )
  })
})
