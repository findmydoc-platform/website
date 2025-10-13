import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { updateAveragePriceAfterChange } from '@/collections/ClinicTreatments/hooks/updateAveragePriceAfterChange'
import { updateAveragePriceAfterDelete } from '@/collections/ClinicTreatments/hooks/updateAveragePriceAfterDelete'

describe('Hook logging configuration', () => {
  const originalSuppressLogs = process.env.SUPPRESS_HOOK_LOGS

  afterEach(() => {
    process.env.SUPPRESS_HOOK_LOGS = originalSuppressLogs
  })

  it('should log info message when SUPPRESS_HOOK_LOGS is false', async () => {
    process.env.SUPPRESS_HOOK_LOGS = 'false'

    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: 100 }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterChange({
      doc: { id: 'ct-1', treatment: 't-1' },
      req: { payload, context: {} },
    } as any)

    expect(payload.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Updating average price after clinic treatment change'),
    )
  })

  it('should NOT log info message when SUPPRESS_HOOK_LOGS is true', async () => {
    process.env.SUPPRESS_HOOK_LOGS = 'true'

    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: 100 }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterChange({
      doc: { id: 'ct-2', treatment: 't-2' },
      req: { payload, context: {} },
    } as any)

    expect(payload.logger.info).not.toHaveBeenCalled()
  })

  it('should log error messages from utility functions on failure', async () => {
    process.env.SUPPRESS_HOOK_LOGS = 'true'

    const payload = {
      find: vi.fn().mockRejectedValue(new Error('Database error')),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterChange({
      doc: { id: 'ct-3', treatment: 't-3' },
      req: { payload, context: {} },
    } as any)

    // Error is logged from calculateAveragePrice utility
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error calculating average price for treatment:t-3'),
      expect.any(Error),
    )
  })

  it('should suppress delete hook info logs when SUPPRESS_HOOK_LOGS is true', async () => {
    process.env.SUPPRESS_HOOK_LOGS = 'true'

    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ price: 100 }] }),
      update: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), error: vi.fn() },
    }

    await updateAveragePriceAfterDelete({
      doc: { id: 'ct-4', treatment: 't-4' },
      req: { payload, context: {} },
    } as any)

    expect(payload.logger.info).not.toHaveBeenCalled()
  })
})
