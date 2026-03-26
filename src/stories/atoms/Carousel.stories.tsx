import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/atoms/carousel'
import { Heading } from '@/components/atoms/Heading'

const slides = [
  {
    title: 'Global reach',
    description: 'Showcase clinics to patients searching for trusted care worldwide.',
  },
  {
    title: 'Verified profiles',
    description: 'Highlight services and specialties with transparent, structured information.',
  },
  {
    title: 'Qualified inquiries',
    description: 'Connect with patients who are ready to take the next step.',
  },
  {
    title: 'Trusted comparisons',
    description: 'Build confidence with clear pricing and outcomes data.',
  },
]

const meta = {
  title: 'Shared/Atoms/Carousel',
  component: Carousel,
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable', 'used-in:shared'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Scrollable container for horizontal or vertical content with accessible controls and keyboard navigation.',
      },
    },
  },
} satisfies Meta<typeof Carousel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="mx-auto w-full max-w-3xl">
      <Carousel opts={{ align: 'start', loop: true }}>
        <CarouselContent className="-ml-6">
          {slides.map((slide) => (
            <CarouselItem key={slide.title} className="basis-full pl-6 sm:basis-1/2 md:basis-1/3">
              <div className="flex h-56 flex-col justify-between rounded-3xl border border-border/60 bg-white p-6 shadow-sm">
                <div className="space-y-3">
                  <Heading as="h3" align="left" size="h5">
                    {slide.title}
                  </Heading>
                  <p className="text-sm text-muted-foreground">{slide.description}</p>
                </div>
                <span className="text-xs font-semibold tracking-wide text-secondary uppercase">findmydoc</span>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="mt-6 flex justify-center gap-3">
          <CarouselPrevious className="static translate-y-0" />
          <CarouselNext className="static translate-y-0" />
        </div>
      </Carousel>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const nextButton = canvas.getByRole('button', { name: 'Next slide' })
    const prevButton = canvas.getByRole('button', { name: 'Previous slide' })

    await expect(nextButton).toBeEnabled()

    await userEvent.click(nextButton)
    await expect(prevButton).toBeEnabled()
    await userEvent.click(prevButton)
  },
}
