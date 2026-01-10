import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from '@storybook/jest'
import { userEvent, waitFor, within } from '@storybook/testing-library'

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

export const CarouselNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const nextButton = canvas.getByRole('button', { name: 'Next testimonial' })
    await expect(nextButton).toBeInTheDocument()

    const firstDot = canvas.getByRole('button', { name: 'Go to testimonial 1' })
    const secondDot = canvas.getByRole('button', { name: 'Go to testimonial 2' })

    await expect(firstDot).toHaveAttribute('aria-current', 'true')
    await expect(secondDot).not.toHaveAttribute('aria-current')

    await userEvent.click(nextButton)

    await waitFor(() => expect(secondDot).toHaveAttribute('aria-current', 'true'))
  },
}
