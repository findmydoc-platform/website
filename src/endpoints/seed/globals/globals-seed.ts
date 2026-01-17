import type { Payload } from 'payload'
import { Page } from '@/payload-types'

// Legacy demo helper (kept for demo content path) — will be replaced by idempotent demo seed later.
export const seedGlobal = async (payload: Payload, contactPage: Page): Promise<void> => {
  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: [
          {
            link: { type: 'custom', label: 'Posts', url: '/posts' },
          },
          {
            link: { type: 'custom', label: 'Clinics', url: '/listing-comparison' },
          },
          {
            link: { type: 'custom', label: 'For Clinics', url: '/partners/clinics' },
          },
          {
            link: {
              type: 'reference',
              label: 'Contact',
              reference: { relationTo: 'pages', value: contactPage.id },
            },
          },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        navItems: [
          { link: { type: 'custom', label: 'Admin', url: '/admin' } },
          { link: { type: 'custom', label: 'Login', newTab: true, url: 'login/' } },
        ],
      },
    }),
  ])
}

/**
 * Seed header & footer globals deterministically (baseline unit).
 * @returns counts (created always 0; updated reflects globals touched)
 */
export async function seedGlobalsBaseline(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding header & footer globals (baseline)...')

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
          { link: { type: 'custom', label: 'Posts', url: '/posts' } },
          { link: { type: 'custom', label: 'Contact', url: '/contact' } },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        navItems: [
          { link: { type: 'custom', label: 'Privacy Policy', url: '/privacy-policy' } },
          { link: { type: 'custom', label: 'Terms', url: '/terms' } },
          { link: { type: 'custom', label: 'About', url: '/about' } },
          { link: { type: 'custom', label: 'Careers', url: '/careers' } },
          { link: { type: 'custom', label: 'Contact', url: '/contact' } },
          { link: { type: 'custom', label: 'Posts', url: '/posts' } },
        ],
      },
    }),
  ])

  payload.logger.info('— Finished seeding header & footer globals.')
  return { created: 0, updated: 2 }
}
