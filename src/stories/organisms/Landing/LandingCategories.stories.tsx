import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { LandingCategories } from '@/components/organisms/Landing'
import { clinicCategoriesData, clinicCategoryFeaturedIds, clinicCategoryItems } from '@/stories/fixtures/listings'
import { withViewportStory } from '../../utils/viewportMatrix'

const meta = {
  title: 'Domain/Landing/Organisms/LandingCategories',
  component: LandingCategories,
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
} satisfies Meta<typeof LandingCategories>

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

export const CategorySwitchScramble320: Story = withViewportStory(
  CategorySwitchScramble,
  'public320',
  'Category switch scramble / 320',
)
export const CategorySwitchScramble375: Story = withViewportStory(
  CategorySwitchScramble,
  'public375',
  'Category switch scramble / 375',
)
export const CategorySwitchScramble640: Story = withViewportStory(
  CategorySwitchScramble,
  'public640',
  'Category switch scramble / 640',
)
export const CategorySwitchScramble768: Story = withViewportStory(
  CategorySwitchScramble,
  'public768',
  'Category switch scramble / 768',
)
export const CategorySwitchScramble1024: Story = withViewportStory(
  CategorySwitchScramble,
  'public1024',
  'Category switch scramble / 1024',
)
export const CategorySwitchScramble1280: Story = withViewportStory(
  CategorySwitchScramble,
  'public1280',
  'Category switch scramble / 1280',
)
