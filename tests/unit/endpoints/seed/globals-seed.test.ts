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
        slug: 'header',
        data: expect.objectContaining({
          navItems: [
            expect.objectContaining({
              link: expect.objectContaining({ url: '/partners/clinics', label: 'For Clinics' }),
            }),
            expect.objectContaining({
              link: expect.objectContaining({ url: '/listing-comparison', label: 'Compare Clinics' }),
            }),
            expect.objectContaining({ link: expect.objectContaining({ url: '/posts', label: 'Blog' }) }),
          ],
        }),
      }),
    )
    expect(updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'footer',
        data: expect.objectContaining({
          aboutLinks: [
            expect.objectContaining({ link: expect.objectContaining({ url: '/about', label: 'About' }) }),
            expect.objectContaining({ link: expect.objectContaining({ url: '/contact', label: 'Contact' }) }),
          ],
          serviceLinks: [
            expect.objectContaining({
              link: expect.objectContaining({ url: '/listing-comparison', label: 'Compare Clinics' }),
            }),
            expect.objectContaining({
              link: expect.objectContaining({ url: '/partners/clinics', label: 'For Clinics' }),
            }),
            expect.objectContaining({
              link: expect.objectContaining({ url: '/register/clinic', label: 'Register Your Clinic' }),
            }),
            expect.objectContaining({ link: expect.objectContaining({ url: '/admin/login', label: 'Staff Login' }) }),
          ],
          informationLinks: [
            expect.objectContaining({ link: expect.objectContaining({ url: '/posts', label: 'Blog' }) }),
            expect.objectContaining({
              link: expect.objectContaining({ url: '/privacy-policy', label: 'Privacy Policy' }),
            }),
            expect.objectContaining({ link: expect.objectContaining({ url: '/imprint', label: 'Imprint' }) }),
          ],
        }),
      }),
    )
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
            registrationIntro: expect.objectContaining({
              title: 'Ready for verified visibility?',
              description:
                'Share the key details. We review your request personally and follow up with the next steps.',
            }),
            teamCta: expect.objectContaining({
              buttonText: 'About us',
              link: expect.objectContaining({
                type: 'custom',
                url: '/about',
              }),
            }),
          }),
        }),
      }),
    )
    expect(result).toEqual({ created: 0, updated: 4 })
  })
})
