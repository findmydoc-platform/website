import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import { vi } from 'vitest'

import DeveloperDashboard from '@/components/organisms/DeveloperDashboard'

vi.mock('@/components/organisms/DeveloperDashboard/Seeding/SeedingCard', () => ({
  SeedingCard: () => <div className="rounded-sm border border-border bg-card p-4">Seeding controls go here.</div>,
}))

const meta = {
  title: 'Organisms/DeveloperDashboard',
  component: DeveloperDashboard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DeveloperDashboard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
