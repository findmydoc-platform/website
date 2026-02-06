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
    await expect(canvas.getByRole('heading', { name: 'Unser Blog' })).toBeInTheDocument()
    await expect(canvas.getByText(/Entdecken Sie wertvolle Einblicke/)).toBeInTheDocument()
  },
}

/**
 * Custom Content
 *
 * Blog hero with custom title and subtitle.
 */
export const CustomContent: Story = {
  args: {
    title: 'Gesundheitsnachrichten',
    subtitle: 'Bleiben Sie auf dem Laufenden mit den neuesten Entwicklungen in der Medizin und Gesundheitsversorgung.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Gesundheitsnachrichten' })).toBeInTheDocument()
    await expect(canvas.getByText(/Bleiben Sie auf dem Laufenden/)).toBeInTheDocument()
  },
}
