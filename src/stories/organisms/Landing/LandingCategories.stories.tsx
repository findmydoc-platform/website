import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { LandingCategoriesClient } from '@/components/organisms/Landing'
import { clinicCategoriesData, clinicCategoryFeaturedIds, clinicCategoryItems } from '@/stories/fixtures/listings'

const meta = {
  title: 'Domain/Landing/Organisms/LandingCategories',
  component: LandingCategoriesClient,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:stable', 'used-in:block:landing-categories'],
  args: {
    title: 'Our Categories',
    description: 'Browse clinic specialties and discover the right treatment.',
    categories: clinicCategoriesData,
    items: clinicCategoryItems,
    featuredIds: clinicCategoryFeaturedIds,
  },
} satisfies Meta<typeof LandingCategoriesClient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ViewAllClinicsHoverText: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const cta = canvas.getByRole('link', { name: 'View all clinics' })
    await expect(cta).toBeInTheDocument()
    await expect(cta).toHaveTextContent('View all clinics')

    // Ensure the slide-fill hover effect sets white text on hover.
    await expect(cta.className).toContain('hover:text-primary-foreground')

    await userEvent.hover(cta)
    await expect(cta).toHaveTextContent('View all clinics')
  },
}

export const CategorySwitchScramble: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('tab', { name: clinicCategoriesData[1]?.label ?? 'Eye Care' }))
    await userEvent.click(canvas.getByRole('tab', { name: clinicCategoriesData[2]?.label ?? 'Hair Restoration' }))

    await expect(
      canvas.getByRole('tab', { name: clinicCategoriesData[2]?.label ?? 'Hair Restoration' }),
    ).toHaveAttribute('aria-selected', 'true')
  },
}
