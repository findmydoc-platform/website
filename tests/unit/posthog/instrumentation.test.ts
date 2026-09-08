import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendPostHogRequestError = vi.hoisted(() => vi.fn())

vi.mock('../../../src/posthog/api', () => ({ sendPostHogRequestError }))

describe('onRequestError', () => {
  const originalEnvironment = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnvironment, NEXT_RUNTIME: 'nodejs' }
  })

  afterEach(() => {
    process.env = originalEnvironment
    vi.restoreAllMocks()
  })

  it('does not change error handling when exception telemetry fails', async () => {
    sendPostHogRequestError.mockRejectedValueOnce(new Error('telemetry unavailable'))
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { onRequestError } = await import('../../../src/instrumentation')
    const error = new Error('boom')
    const request = { method: 'GET', url: '/api/health' }

    await expect(onRequestError(error, request, {})).resolves.toBeUndefined()
    expect(sendPostHogRequestError).toHaveBeenCalledWith(error, request)
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'telemetry.posthog.request_error_send_failed' }),
      'PostHog telemetry failed; continuing',
    )
  })
})
