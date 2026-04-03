import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { seedGlobalsBaseline } from '@/endpoints/seed/globals/globals-seed'

describe('seedGlobalsBaseline', () => {
  it('seeds header, footer, and cookie consent globals', async () => {
    const updateGlobal = vi.fn().mockResolvedValue(undefined)
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 42 }],
    })
    const payload = {
      find,
      updateGlobal,
      logger: {
        info: vi.fn(),
      },
    } as unknown as Payload

    const result = await seedGlobalsBaseline(payload)

    expect(updateGlobal).toHaveBeenCalledTimes(3)
    expect(updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'cookieConsent',
        data: expect.objectContaining({
          enabled: true,
          consentVersion: 3,
          privacyPolicyPage: 42,
          optionalCategorySettings: expect.objectContaining({
            functional: expect.objectContaining({
              tools: ['openstreetmap'],
            }),
            analytics: expect.objectContaining({
              tools: ['posthog'],
            }),
            marketing: expect.objectContaining({
              tools: [],
            }),
          }),
        }),
      }),
    )
    expect(result).toEqual({ created: 0, updated: 3 })
  })
})
