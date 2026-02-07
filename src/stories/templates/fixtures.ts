import type { Footer, Header } from '@/payload-types'

const createNavItem = (label: string, url: string) =>
  ({
    link: {
      type: 'custom',
      url,
      label,
      newTab: false,
    },
  }) as const

const createNavItemWithSubs = (label: string, url: string, subs: Array<{ label: string; url: string }>) =>
  ({
    link: {
      type: 'custom' as const,
      url,
      label,
      newTab: false,
    },
    subItems: subs.map((sub) => ({
      link: {
        type: 'custom' as const,
        url: sub.url,
        label: sub.label,
        newTab: false,
      },
    })),
  }) as const

export const headerData: Header = {
  id: 1,
  navItems: [
    createNavItem('Clinics', '/clinics'),
    createNavItem('Treatments', '/treatments'),
    createNavItem('Stories', '/stories'),
    createNavItem('Contact', '/contact'),
  ],
  createdAt: '2024-05-01T00:00:00.000Z',
  updatedAt: '2024-05-05T00:00:00.000Z',
}

export const headerDataWithSubmenus: Header = {
  id: 2,
  navItems: [
    createNavItemWithSubs('Clinics', '/clinics', [
      { label: 'All Clinics', url: '/clinics' },
      { label: 'Top Rated', url: '/clinics/top-rated' },
      { label: 'Near Me', url: '/clinics/near-me' },
    ]),
    createNavItemWithSubs('Treatments', '/treatments', [
      { label: 'All Treatments', url: '/treatments' },
      { label: 'Dental', url: '/treatments/dental' },
      { label: 'Cosmetic', url: '/treatments/cosmetic' },
      { label: 'Orthopedic', url: '/treatments/orthopedic' },
    ]),
    createNavItem('Stories', '/stories'),
    createNavItem('Contact', '/contact'),
  ],
  createdAt: '2024-05-01T00:00:00.000Z',
  updatedAt: '2024-05-05T00:00:00.000Z',
}

export const footerData: Footer = {
  id: 1,
  navItems: [
    createNavItem('Privacy Policy', '/privacy'),
    createNavItem('Terms of Service', '/terms'),
    createNavItem('Imprint', '/imprint'),
  ],
  createdAt: '2024-05-01T00:00:00.000Z',
  updatedAt: '2024-05-05T00:00:00.000Z',
}
