import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'
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

/** Desktop submenu should use neutral visuals: no first-level hover bg and white dropdown panel. */
export const DesktopNeutralSubmenu: Story = {
  args: {
    navItems: navItemsWithSubs,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const trigger = canvas.getByRole('button', { name: 'Clinics' })
    const firstLevelLink = canvas.getByRole('link', { name: 'Stories' })
    const dropdownContainer = trigger.closest('div')

    expect(trigger.className).not.toContain('hover:bg-zinc-100')
    expect(firstLevelLink.className).not.toContain('hover:bg-zinc-100')

    if (!dropdownContainer) throw new Error('Missing dropdown container')
    trigger.focus()
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))

    const submenuItem = await waitFor(() => canvas.getByRole('link', { name: 'All Clinics' }))
    const submenuList = submenuItem.closest('ul')
    const submenu = submenuList?.parentElement

    expect(submenu).toBeTruthy()
    expect(submenu).toHaveClass('bg-white')
    expect(submenuItem.className).toContain('hover:bg-zinc-200/70')
  },
}

/** Desktop submenu should remain open briefly to allow pointer travel into submenus. */
export const DesktopHoverTolerance: Story = {
  args: {
    navItems: navItemsWithSubs,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Clinics' })
    const dropdownContainer = trigger.closest('div')

    if (!dropdownContainer) throw new Error('Missing dropdown container')

    trigger.focus()
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
    await waitFor(() => expect(canvas.getByRole('link', { name: 'All Clinics' })).toBeInTheDocument())

    dropdownContainer.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(canvas.getByRole('link', { name: 'All Clinics' })).toBeInTheDocument()

    await new Promise((resolve) => setTimeout(resolve, 120))
<<<<<<< ours
    await waitFor(() => expect(canvas.queryByRole('menuitem', { name: 'All Clinics' })).not.toBeInTheDocument())
=======
    await waitFor(() => expect(canvas.queryByRole('link', { name: 'All Clinics' })).not.toBeInTheDocument())
>>>>>>> theirs
  },
}

/** Mobile accordion parent items should stay compact when submenu groups are present. */
export const MobileCompactSubmenu: Story = {
  args: {
    navItems: navItemsWithSubs,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /open menu/i }))

    const mobileNav = canvas.getByLabelText('Mobile navigation')
    const mobileCanvas = within(mobileNav)
    const clinicsTrigger = mobileCanvas.getByRole('button', { name: 'Clinics' })

    expect(clinicsTrigger.className).toContain('text-base')
    expect(clinicsTrigger.className).toContain('py-2')

    await userEvent.click(clinicsTrigger)
    expect(mobileCanvas.getByRole('link', { name: 'All Clinics' })).toBeInTheDocument()
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
