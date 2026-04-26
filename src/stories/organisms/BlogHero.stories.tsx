import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { BlogHero } from '@/components/organisms/Blog/BlogHero'
import { withViewportStory } from '../utils/viewportMatrix'

/**
 * BlogHero Component
 *
 * Hero banner for blog listing page with gradient background.
 * Features: solid gradient, decorative circles, centered heading + subtitle.
 */
const meta = {
  title: 'Domain/Blog/Organisms/BlogHero',
  component: BlogHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:blog', 'layer:organism', 'status:stable', 'used-in:block:blog-hero'],
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

const denseCopyBase: Story = {
  args: {
    title: 'Insights for medical travel',
    subtitle:
      'Treatment planning, travel preparation, aftercare, and clinic-comparison guidance for patients who need clarity on small screens and large screens alike.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Insights for medical travel' })).toBeInTheDocument()
    await expect(canvas.getByText(/Treatment planning, travel preparation/)).toBeInTheDocument()
  },
}

export const DenseCopy320: Story = withViewportStory(denseCopyBase, 'public320', 'Dense copy / 320')
export const DenseCopy375: Story = withViewportStory(denseCopyBase, 'public375', 'Dense copy / 375')
export const DenseCopy640: Story = withViewportStory(denseCopyBase, 'public640', 'Dense copy / 640')
export const DenseCopy768: Story = withViewportStory(denseCopyBase, 'public768', 'Dense copy / 768')
export const DenseCopy1024: Story = withViewportStory(denseCopyBase, 'public1024', 'Dense copy / 1024')
export const DenseCopy1280: Story = withViewportStory(denseCopyBase, 'public1280', 'Dense copy / 1280')
