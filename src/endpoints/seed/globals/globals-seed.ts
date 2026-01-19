import type { Payload } from 'payload'

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
