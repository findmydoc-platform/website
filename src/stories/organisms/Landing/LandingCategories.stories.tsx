import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { LandingCategories } from '@/components/organisms/Landing'
import { clinicCategoriesData, clinicCategoryImages } from '@/stories/fixtures/listings'

const meta = {
  title: 'Organisms/Landing/LandingCategories',
  component: LandingCategories,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    categories: clinicCategoriesData,
    images: clinicCategoryImages,
    moreCategoriesLink: {
      href: '#',
      label: 'More Categories',
    },
  },
} satisfies Meta<typeof LandingCategories>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MoreCategoriesHoverText: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const cta = canvas.getByRole('link', { name: 'More Categories' })
    await expect(cta).toBeInTheDocument()
    await expect(cta).toHaveTextContent('More Categories')

    // Ensure the slide-fill hover effect sets white text on hover.
    await expect(cta.className).toContain('hover:text-primary-foreground')

    await userEvent.hover(cta)
    await expect(cta).toHaveTextContent('More Categories')
  },
}
