import type { Meta, StoryObj } from '@storybook/react-vite'

import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'
import { withMockRouter } from '../utils/routerDecorator'

const meta = {
  title: 'Domain/Cms/Organisms/LivePreviewListener',
  component: LivePreviewListener,
  decorators: [withMockRouter],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs', 'domain:cms', 'layer:organism', 'status:stable', 'used-in:block:live-preview-listener'],
} satisfies Meta<typeof LivePreviewListener>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
