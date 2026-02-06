import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { BlogHero } from '@/components/organisms/Blog/BlogHero'

/**
 * BlogHero Component
 *
 * Hero banner for blog listing page with gradient background.
 * Features: solid gradient, decorative circles, centered heading + subtitle.
 */
const meta = {
  title: 'Organisms/BlogHero',
  component: BlogHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BlogHero>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Default
 *
 * Blog hero with default title and subtitle.
 * Gradient from primary to primary-hover with decorative circles.
 */
export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Our Blog' })).toBeInTheDocument()
    await expect(canvas.getByText(/Expert insights, practical guidance/)).toBeInTheDocument()
  },
}

/**
 * Custom Content
 *
 * Blog hero with custom title and subtitle.
 */
export const CustomContent: Story = {
  args: {
    title: 'Health News',
    subtitle: 'Stay up to date with the latest developments in medicine and healthcare.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Health News' })).toBeInTheDocument()
    await expect(canvas.getByText(/Stay up to date/)).toBeInTheDocument()
  },
}
