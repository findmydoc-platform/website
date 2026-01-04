import type { Meta, StoryObj } from '@storybook/react-vite'
import { Footer } from '@/components/templates/Footer/Component'
import { footerData, headerData } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'
import { normalizeNavItems } from '@/utilities/normalizeNavItems'

const meta = {
  title: 'Templates/Footer',
  component: Footer,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    footerNavItems: normalizeNavItems(footerData),
    headerNavItems: normalizeNavItems(headerData),
  },
} satisfies Meta<typeof Footer>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FocusedLegalLinks: Story = {
  args: {
    footerNavItems: normalizeNavItems({ ...footerData, navItems: footerData.navItems?.slice(0, 1) ?? null }),
    headerNavItems: [],
  },
}

export const WithoutNavLinks: Story = {
  args: {
    footerNavItems: [],
    headerNavItems: [],
  },
}
