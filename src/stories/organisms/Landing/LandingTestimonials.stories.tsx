import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'

import { LandingTestimonials } from '@/components/organisms/Landing'
import { clinicTestimonialsData } from '@/stories/fixtures/listings'
import { withViewportStory } from '../../utils/viewportMatrix'

const meta = {
  title: 'Domain/Landing/Organisms/LandingTestimonials',
  component: LandingTestimonials,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:stable', 'used-in:block:landing-testimonials'],
  args: {
    testimonials: clinicTestimonialsData,
    title: 'Testimonials',
    description: 'What our partners say about working with us.',
  },
} satisfies Meta<typeof LandingTestimonials>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CarouselNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const getDots = () => canvas.getAllByRole('button', { name: /^Go to slide \d+ of \d+$/ })

    const dots = getDots()
    await expect(dots.length).toBeGreaterThanOrEqual(2)

    const firstDot = dots[0]!
    const secondDot = dots[1]!

    await expect(firstDot).toHaveAttribute('aria-current', 'true')
    await expect(secondDot).not.toHaveAttribute('aria-current')

    await userEvent.click(secondDot)

    await waitFor(() => {
      const updatedDots = getDots()
      expect(updatedDots[1]).toHaveAttribute('aria-current', 'true')
    })

    // Keyboard navigation (carousel region is focusable)
    const region = canvas.getByRole('region', { name: 'Testimonials' })
    await userEvent.click(region)
    await expect(region).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')

    // Should move the active dot away from the current one.
    await waitFor(() => {
      const updatedDots = getDots()
      expect(updatedDots[1]).not.toHaveAttribute('aria-current', 'true')
      expect(updatedDots.some((dot) => dot.getAttribute('aria-current') === 'true')).toBe(true)
    })
  },
}

export const CarouselNavigation320: Story = withViewportStory(
  CarouselNavigation,
  'public320',
  'Carousel navigation / 320',
)
export const CarouselNavigation375: Story = withViewportStory(
  CarouselNavigation,
  'public375',
  'Carousel navigation / 375',
)
export const CarouselNavigation640: Story = withViewportStory(
  CarouselNavigation,
  'public640',
  'Carousel navigation / 640',
)
export const CarouselNavigation768: Story = withViewportStory(
  CarouselNavigation,
  'public768',
  'Carousel navigation / 768',
)
export const CarouselNavigation1024: Story = withViewportStory(
  CarouselNavigation,
  'public1024',
  'Carousel navigation / 1024',
)
export const CarouselNavigation1280: Story = withViewportStory(
  CarouselNavigation,
  'public1280',
  'Carousel navigation / 1280',
)
