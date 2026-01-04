import type { Meta, StoryObj } from '@storybook/react-vite'
import { Header } from '@/components/templates/Header/Component'
import { headerData } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'
import { normalizeNavItems } from '@/utilities/normalizeNavItems'

const navItems = normalizeNavItems(headerData)

const meta = {
  title: 'Templates/Header',
  component: Header,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    navItems,
  },
} satisfies Meta<typeof Header>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CompactNav: Story = {
  args: {
    navItems: navItems.slice(0, 2),
  },
}
