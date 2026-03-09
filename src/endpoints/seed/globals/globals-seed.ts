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
  ])

  payload.logger.info('— Finished seeding header & footer globals.')
  return { created: 0, updated: 2 }
}
