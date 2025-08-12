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
  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: [
          { link: { type: 'custom', label: 'Posts', url: '/posts' } },
          { link: { type: 'custom', label: 'Admin', url: '/admin' } },
        ],
      },
      context: { disableRevalidate: true },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        navItems: [
          { link: { type: 'custom', label: 'Privacy', url: '/privacy' } },
          { link: { type: 'custom', label: 'Login', url: '/login' } },
        ],
      },
      context: { disableRevalidate: true },
    }),
  ])
  return { created: 0, updated: 2 }
}
