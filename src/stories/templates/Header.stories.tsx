import type { Meta, StoryObj } from '@storybook/react'
import { HeaderClient } from '@/components/templates/Header/Component.client'
import { headerData } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'

const meta = {
  title: 'Templates/Header',
  component: HeaderClient,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    data: headerData,
  },
} satisfies Meta<typeof HeaderClient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CompactNav: Story = {
  args: {
    data: {
      ...headerData,
      navItems: headerData.navItems?.slice(0, 2),
    },
  },
}
