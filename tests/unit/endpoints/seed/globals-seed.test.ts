import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { seedGlobalsBaseline } from '@/endpoints/seed/globals/globals-seed'

describe('seedGlobalsBaseline', () => {
  it('seeds all baseline globals', async () => {
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

    expect(updateGlobal).toHaveBeenCalledTimes(4)
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
    expect(updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'landingPages',
        context: { disableRevalidate: true },
        data: expect.objectContaining({
          home: expect.objectContaining({
            hero: expect.objectContaining({
              title: 'Clinic Comparison Turkey for Aesthetic Treatments',
              image: 42,
            }),
          }),
          clinicPartners: expect.objectContaining({
            cta: expect.objectContaining({
              link: expect.objectContaining({
                type: 'custom',
                url: '/contact',
              }),
            }),
          }),
        }),
      }),
    )
    expect(result).toEqual({ created: 0, updated: 4 })
  })
})
