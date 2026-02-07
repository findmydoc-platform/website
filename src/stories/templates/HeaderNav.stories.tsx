import type { Meta, StoryObj } from '@storybook/react-vite'
import { HeaderNav } from '@/components/templates/Header/Nav'
import { withMockRouter } from '../utils/routerDecorator'
import type { HeaderNavItem } from '@/utilities/normalizeNavItems'

const meta = {
  title: 'Templates/HeaderNav',
  component: HeaderNav,
  decorators: [withMockRouter],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Navigation bar rendered inside the site header. Supports flat links and optional dropdown submenus on desktop, with accordion behaviour on mobile.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HeaderNav>

export default meta

type Story = StoryObj<typeof meta>

const defaultNavItems: HeaderNavItem[] = [
  { href: '/clinics', label: 'Clinics', newTab: false },
  { href: '/treatments', label: 'Treatments', newTab: false },
  { href: '/stories', label: 'Stories', newTab: false },
  { href: '/contact', label: 'Contact', newTab: false },
]

const navItemsWithSubs: HeaderNavItem[] = [
  {
    href: '/clinics',
    label: 'Clinics',
    newTab: false,
    subItems: [
      { href: '/clinics', label: 'All Clinics', newTab: false },
      { href: '/clinics/top-rated', label: 'Top Rated', newTab: false },
      { href: '/clinics/near-me', label: 'Near Me', newTab: false },
    ],
  },
  {
    href: '/treatments',
    label: 'Treatments',
    newTab: false,
    subItems: [
      { href: '/treatments', label: 'All Treatments', newTab: false },
      { href: '/treatments/dental', label: 'Dental', newTab: false },
      { href: '/treatments/cosmetic', label: 'Cosmetic', newTab: false },
      { href: '/treatments/orthopedic', label: 'Orthopedic', newTab: false },
    ],
  },
  { href: '/stories', label: 'Stories', newTab: false },
  { href: '/contact', label: 'Contact', newTab: false },
]

const manyNavItems: HeaderNavItem[] = [
  { href: '/clinics', label: 'Clinics', newTab: false },
  { href: '/treatments', label: 'Treatments', newTab: false },
  { href: '/specialists', label: 'Specialists', newTab: false },
  { href: '/stories', label: 'Patient Stories', newTab: false },
  { href: '/about', label: 'About Us', newTab: false },
  { href: '/blog', label: 'Blog', newTab: false },
  { href: '/contact', label: 'Contact', newTab: false },
  { href: '/faq', label: 'FAQ', newTab: false },
]

/** Default flat navigation items without submenus. */
export const Default: Story = {
  args: {
    navItems: defaultNavItems,
  },
}

/** Empty state with no navigation items. */
export const Empty: Story = {
  args: {
    navItems: [],
  },
}

/** Navigation items with dropdown submenus on selected entries. */
export const WithSubmenus: Story = {
  args: {
    navItems: navItemsWithSubs,
  },
}

/**
 * This story demonstrates the flex-wrap behavior introduced in PR #569.
 * With many navigation items (8), the nav should wrap gracefully on narrow viewports
 * without causing horizontal scrollbars.
 *
 * Test by resizing the viewport to mobile widths (e.g., 375px, 320px).
 */
export const ManyItems: Story = {
  args: {
    navItems: manyNavItems,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Demonstrates wrapping at tablet breakpoint.
 */
export const ManyItemsTablet: Story = {
  args: {
    navItems: manyNavItems,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
}
