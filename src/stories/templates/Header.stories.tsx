import type { Meta, StoryObj } from '@storybook/react-vite'
import { Header } from '@/components/templates/Header/Component'
import { headerData, headerDataWithSubmenus } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'
import { normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'

const navItems = normalizeHeaderNavItems(headerData)
const navItemsWithSubs = normalizeHeaderNavItems(headerDataWithSubmenus)
const denseNavItems = navItemsWithSubs.map((item, index) => ({
  ...item,
  label: index === 0 ? 'Compare international clinics' : item.label,
  subItems: item.subItems?.map((sub, subIndex) => ({
    ...sub,
    label: subIndex === 0 ? `${sub.label} and treatment guidance` : sub.label,
  })),
}))

const meta = {
  title: 'Shared/Templates/Header',
  component: Header,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Site header with logo and main navigation. Supports flat links and two-level navigation with dropdown submenus on desktop and accordion on mobile.',
      },
    },
  },
  tags: ['autodocs', 'domain:shared', 'layer:template', 'status:stable', 'used-in:route:/'],
  args: {
    navItems,
  },
} satisfies Meta<typeof Header>

export default meta

type Story = StoryObj<typeof meta>

/** Header with flat navigation items (no submenus). */
export const Default: Story = {}

/** Header with only two navigation items. */
export const CompactNav: Story = {
  args: {
    navItems: navItems.slice(0, 2),
  },
}

/** Header with submenu items on selected top-level entries. */
export const WithSubmenus: Story = {
  args: {
    navItems: navItemsWithSubs,
  },
}

/** Header stress case with longer mobile labels and nested links. */
export const DenseNavigation: Story = {
  args: {
    navItems: denseNavItems,
  },
}
