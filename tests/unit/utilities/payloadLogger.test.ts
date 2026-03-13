import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultLoggerOptions } from 'payload'
import { createPayloadLoggerConfig } from '@/utilities/logging/payloadLogger'

describe('createPayloadLoggerConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses Payload pretty logging in development', () => {
    const config = createPayloadLoggerConfig({ NODE_ENV: 'development' })

    expect(config).toEqual(
      expect.objectContaining({
        destination: defaultLoggerOptions,
        options: expect.objectContaining({
          level: 'warn',
          messageKey: 'msg',
          name: 'findmydoc',
          base: { deploymentEnv: 'development' },
        }),
      }),
    )
  })

  it('uses info level JSON logs for Vercel preview by default', () => {
    const config = createPayloadLoggerConfig({ VERCEL_ENV: 'preview' })

    expect(config).toEqual({
      options: expect.objectContaining({
        level: 'info',
        base: { deploymentEnv: 'preview' },
      }),
    })
  })

  it('uses warn level JSON logs for production by default', () => {
    const config = createPayloadLoggerConfig({ VERCEL_ENV: 'production' })

    expect(config).toEqual({
      options: expect.objectContaining({
        level: 'warn',
        base: { deploymentEnv: 'production' },
      }),
    })
  })

  it('uses error level logs for test runtime', () => {
    const config = createPayloadLoggerConfig({
      NODE_ENV: 'test',
    })

    expect(config).toEqual({
      options: expect.objectContaining({
        level: 'error',
      }),
    })
  })

  it('redacts auth and secret fields centrally', () => {
    const config = createPayloadLoggerConfig({ NODE_ENV: 'development' }) as {
      options: {
        redact: {
          paths: string[]
          remove: boolean
        }
      }
    }

    expect(config.options).toEqual(
      expect.objectContaining({
        redact: expect.objectContaining({
          remove: true,
          paths: expect.arrayContaining([
            'password',
            'token',
            'accessToken',
            'refreshToken',
            'headers.authorization',
            'headers.cookie',
            'req.headers.authorization',
            'req.headers.cookie',
            'secretAccessKey',
          ]),
        }),
      }),
    )
  })
})
