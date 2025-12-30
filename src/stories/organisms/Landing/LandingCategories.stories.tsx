import type { Meta, StoryObj } from '@storybook/nextjs-vite'

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
  },
} satisfies Meta<typeof LandingCategories>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
