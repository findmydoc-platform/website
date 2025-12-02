import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import React from 'react'
import { LowImpactHero } from '@/components/organisms/Heroes/LowImpact'
import { sampleLowImpactHero } from './fixtures'

const meta = {
  title: 'Organisms/Heroes/LowImpactHero',
  component: LowImpactHero,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LowImpactHero>

export default meta

type Story = StoryObj<typeof meta>

export const RichTextOnly: Story = {
  args: sampleLowImpactHero,
}

export const WithCustomChildren: Story = {
  args: {
    children: (
      <div>
        <h2 className="text-3xl font-semibold">Diagnostic excellence, simplified.</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Drop in your own content tree to reuse the spacing and layout shell.
        </p>
      </div>
    ),
  },
}
