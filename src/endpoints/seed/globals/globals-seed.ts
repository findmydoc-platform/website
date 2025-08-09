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

// Baseline globals seeding (no dependency on demo pages) — treated as baseline seed unit.
export async function seedGlobalsBaseline(payload: Payload): Promise<{ created: number; updated: number }> {
  // We treat updates as idempotent; for simplicity we do not attempt to distinguish created vs updated here.
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
