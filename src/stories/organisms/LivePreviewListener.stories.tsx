import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import React from 'react'
import { vi } from 'vitest'

import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'
import { withMockRouter } from '../utils/routerDecorator'

vi.mock('@payloadcms/live-preview-react', () => ({
  RefreshRouteOnSave: ({ serverURL }: { serverURL?: string }) => (
    <div>Live preview connected to {serverURL}</div>
  ),
}))

const meta = {
  title: 'Organisms/LivePreviewListener',
  component: LivePreviewListener,
  decorators: [withMockRouter],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LivePreviewListener>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
