import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FooterContent } from '@/components/templates/Footer/FooterContent'
import { footerData, headerData } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'

const meta = {
  title: 'Templates/Footer',
  component: FooterContent,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    footerData,
    headerData,
  },
} satisfies Meta<typeof FooterContent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FocusedLegalLinks: Story = {
  args: {
    footerData: {
      ...footerData,
      navItems: footerData.navItems?.slice(0, 1),
    },
  },
}
