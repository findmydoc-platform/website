import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { LandingTestimonials } from '@/components/organisms/Landing'
import { clinicTestimonialsData } from '@/stories/fixtures/listings'

const meta = {
  title: 'Organisms/Landing/LandingTestimonials',
  component: LandingTestimonials,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    testimonials: clinicTestimonialsData,
  },
} satisfies Meta<typeof LandingTestimonials>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
