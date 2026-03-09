import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('getServerLogger', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('payload')
    vi.doUnmock('@payload-config')
  })

  it('retries payload initialization after a failed bootstrap attempt', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    }
    const getPayload = vi.fn().mockRejectedValueOnce(new Error('bootstrap failed')).mockResolvedValueOnce({ logger })

    vi.doMock('payload', () => ({
      getPayload,
    }))
    vi.doMock('@payload-config', () => ({
      default: { test: true },
    }))

    const { getServerLogger } = await import('@/utilities/logging/serverLogger')

    const fallbackLogger = await getServerLogger()
    const recoveredLogger = await getServerLogger()

    expect(fallbackLogger.level).toBe('error')
    expect(recoveredLogger).toBe(logger)
    expect(getPayload).toHaveBeenCalledTimes(2)
    expect(consoleErrorSpy).toHaveBeenCalledOnce()
  })
})
