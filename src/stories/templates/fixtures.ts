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
