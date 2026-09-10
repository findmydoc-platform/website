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

  it('awaits canonical request telemetry in the supported error hook', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { onRequestError } = await import('../../../src/instrumentation')
    const error = new Error('boom')
    const request = { headers: {}, method: 'GET', path: '/clinics/42?preview=true' }
    const context = {
      revalidateReason: undefined,
      routePath: '/clinics/[clinicId]',
      routeType: 'render' as const,
      routerKind: 'App Router' as const,
    }

    await expect(onRequestError(error, request, context)).resolves.toBeUndefined()

    expect(sendPostHogRequestError).toHaveBeenCalledWith(error, {
      method: 'GET',
      route: '/clinics/[clinicId]',
    })
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it('contains telemetry failures without rejecting the error hook', async () => {
    sendPostHogRequestError.mockRejectedValueOnce(new Error('telemetry unavailable'))
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { onRequestError } = await import('../../../src/instrumentation')

    await expect(
      onRequestError(
        new Error('boom'),
        { headers: {}, method: 'GET', path: '/api/health' },
        {
          revalidateReason: undefined,
          routePath: '/api/health',
          routeType: 'route',
          routerKind: 'App Router',
        },
      ),
    ).resolves.toBeUndefined()
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'telemetry.posthog.request_error_send_failed' }),
      'PostHog telemetry failed; continuing',
    )
  })
})
