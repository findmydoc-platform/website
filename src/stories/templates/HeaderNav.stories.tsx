import type { Meta, StoryObj } from '@storybook/react-vite'
import { HeaderNav } from '@/components/templates/Header/Nav'
import { withMockRouter } from '../utils/routerDecorator'
import type { UiLinkProps } from '@/components/molecules/Link'

const meta = {
  title: 'Templates/HeaderNav',
  component: HeaderNav,
  decorators: [withMockRouter],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HeaderNav>

export default meta

type Story = StoryObj<typeof meta>

const defaultNavItems: UiLinkProps[] = [
  { href: '/clinics', label: 'Clinics' },
  { href: '/treatments', label: 'Treatments' },
  { href: '/stories', label: 'Stories' },
  { href: '/contact', label: 'Contact' },
]

const manyNavItems: UiLinkProps[] = [
  { href: '/clinics', label: 'Clinics' },
  { href: '/treatments', label: 'Treatments' },
  { href: '/specialists', label: 'Specialists' },
  { href: '/stories', label: 'Patient Stories' },
  { href: '/about', label: 'About Us' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
]

export const Default: Story = {
  args: {
    navItems: defaultNavItems,
  },
}

export const Empty: Story = {
  args: {
    navItems: [],
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
