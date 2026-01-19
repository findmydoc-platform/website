import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'

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

    const dots = canvas.getAllByRole('button', { name: /^Go to slide \d+ of \d+$/ })
    await expect(dots.length).toBeGreaterThanOrEqual(2)

    const firstDot = dots[0]!
    const secondDot = dots[1]!

    await expect(firstDot).toHaveAttribute('aria-current', 'true')
    await expect(secondDot).not.toHaveAttribute('aria-current')

    await userEvent.click(secondDot)

    await waitFor(() => expect(secondDot).toHaveAttribute('aria-current', 'true'))

    // Keyboard navigation (carousel region is focusable)
    const region = canvas.getByRole('region', { name: 'Testimonials' })
    await userEvent.click(region)
    await expect(region).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')

    // Should move the active dot away from the current one.
    await waitFor(() => expect(secondDot).not.toHaveAttribute('aria-current', 'true'))
  },
}
