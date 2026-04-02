import type { Payload } from 'payload'

import type { CookieConsent as CookieConsentGlobal } from '@/payload-types'

import { prepareCookieConsentSeedData } from '../utils/cookie-consent'

/**
 * Seed header, footer, and cookie consent globals deterministically (baseline unit).
 * @returns counts (created always 0; updated reflects globals touched)
 */
export async function seedGlobalsBaseline(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding header, footer, and cookie consent globals (baseline)...')

  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: [
          { link: { type: 'custom', label: 'About', url: '/about' } },
          { link: { type: 'custom', label: 'Treatments', url: '/treatments' } },
          { link: { type: 'custom', label: 'Doctors', url: '/doctors' } },
          { link: { type: 'custom', label: 'Clinics', url: '/listing-comparison' } },
          { link: { type: 'custom', label: 'For Clinics', url: '/partners/clinics' } },
          { link: { type: 'custom', label: 'Contact', url: '/contact' } },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        aboutLinks: [
          { link: { type: 'custom', label: 'Partner Landing', url: '/partners/clinics' } },
          { link: { type: 'custom', label: 'Compare Clinics', url: '/listing-comparison' } },
          { link: { type: 'custom', label: 'Blog', url: '/posts' } },
        ],
        serviceLinks: [
          { link: { type: 'custom', label: 'Login Patient', url: '/login/patient' } },
          { link: { type: 'custom', label: 'Login Admin', url: '/admin/login' } },
          { link: { type: 'custom', label: 'Register Clinic', url: '/register/clinic' } },
          { link: { type: 'custom', label: 'Register Patient', url: '/register/patient' } },
        ],
        informationLinks: [
          { link: { type: 'custom', label: 'Privacy Policy', url: '/privacy-policy' } },
          { link: { type: 'custom', label: 'Imprint', url: '/imprint' } },
          { link: { type: 'custom', label: 'About', url: '/about' } },
          { link: { type: 'custom', label: 'Careers', url: '/careers' } },
          { link: { type: 'custom', label: 'Contact', url: '/contact' } },
          { link: { type: 'custom', label: 'Posts', url: '/posts' } },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'cookieConsent',
      data: (await prepareCookieConsentSeedData(payload, {
        enabled: true,
        consentVersion: 3,
        bannerTitle: 'Cookies on findmydoc',
        bannerDescription:
          'We use essential cookies to keep the site working and optional cookies to understand usage and improve the experience.',
        acceptLabel: 'Accept all',
        rejectLabel: 'Reject all',
        customizeLabel: 'Customize',
        settingsTitle: 'Cookie settings',
        settingsDescription: 'Choose which optional cookies you allow. Essential cookies are always active.',
        essentialLabel: 'Essential cookies',
        essentialDescription: 'Required for core site functionality, security, and consent persistence.',
        optionalCategorySettings: {
          functional: {
            enabled: true,
            label: 'Functional cookies',
            tools: ['openstreetmap'],
          },
          analytics: {
            enabled: true,
            label: 'Analytics cookies',
            tools: ['posthog'],
          },
          marketing: {
            enabled: true,
            label: 'Marketing cookies',
            tools: [],
          },
        },
        cancelLabel: 'Cancel',
        saveLabel: 'Save preferences',
        reopenLabel: 'Cookie settings',
        privacyPolicyLabel: 'Privacy Policy',
        privacyPolicyPage: 'privacy-policy',
      })) as unknown as CookieConsentGlobal,
    }),
  ])

  payload.logger.info('— Finished seeding header, footer, and cookie consent globals.')
  return { created: 0, updated: 3 }
}
