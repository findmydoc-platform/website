import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

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

const dispatchTouch = (
  dispatchTarget: EventTarget,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  points: Array<{ clientX: number; clientY: number }>,
  touchTarget?: HTMLElement,
) => {
  const target = touchTarget ?? (dispatchTarget instanceof HTMLElement ? dispatchTarget : document.body)
  const touches = points.map((point, index) => ({
    identifier: index,
    target,
    clientX: point.clientX,
    clientY: point.clientY,
    pageX: point.clientX,
    pageY: point.clientY,
    screenX: point.clientX,
    screenY: point.clientY,
  }))
  const event = new Event(type, { bubbles: true, cancelable: true })

  Object.defineProperties(event, {
    touches: {
      value: type === 'touchend' || type === 'touchcancel' ? [] : touches,
    },
    targetTouches: {
      value: type === 'touchend' || type === 'touchcancel' ? [] : touches,
    },
    changedTouches: {
      value: touches,
    },
  })

  dispatchTarget.dispatchEvent(event)
}

const getActiveSlide = (canvasElement: HTMLElement) => {
  const slide = canvasElement.querySelector<HTMLElement>(
    '[data-testid="landing-testimonials-slide"][data-slide-selected="true"]',
  )

  if (!slide) {
    throw new Error('Missing active LandingTestimonials slide.')
  }

  return slide
}

const expectDotsToBeTouchFriendly = (dots: HTMLElement[]) => {
  dots.forEach((dot) => {
    const rect = dot.getBoundingClientRect()

    expect(rect.width).toBeGreaterThanOrEqual(44)
    expect(rect.height).toBeGreaterThanOrEqual(44)
  })
}

const expectVisibleSlidesNotToTouch = (canvasElement: HTMLElement) => {
  const activeSlide = getActiveSlide(canvasElement)
  const viewport = canvasElement.querySelector<HTMLElement>('[data-testid="landing-testimonials-viewport"]')

  if (!viewport) {
    throw new Error('Missing LandingTestimonials viewport.')
  }

  const activeRect = activeSlide.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  const slides = [...canvasElement.querySelectorAll<HTMLElement>('[data-testid="landing-testimonials-slide"]')]
  const visibleNeighbors = slides
    .filter((slide) => slide !== activeSlide)
    .map((slide) => slide.getBoundingClientRect())
    .filter((rect) => rect.right > viewportRect.left && rect.left < viewportRect.right)

  expect(activeRect.left).toBeGreaterThanOrEqual(viewportRect.left - 2)
  expect(activeRect.right).toBeLessThanOrEqual(viewportRect.right + 2)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)

  visibleNeighbors.forEach((rect) => {
    expect(rect.left < activeRect.right && rect.right > activeRect.left).toBe(false)
  })

  if (window.innerWidth < 1024) return

  const leftGaps = visibleNeighbors.map((rect) => activeRect.left - rect.right).filter((gap) => gap >= 0)
  const rightGaps = visibleNeighbors.map((rect) => rect.left - activeRect.right).filter((gap) => gap >= 0)

  expect(leftGaps.length).toBeGreaterThan(0)
  expect(rightGaps.length).toBeGreaterThan(0)
  expect(Math.min(...leftGaps)).toBeGreaterThanOrEqual(32)
  expect(Math.min(...rightGaps)).toBeGreaterThanOrEqual(32)
}

const waitForStableCarouselLayout = async (canvasElement: HTMLElement) => {
  const track = canvasElement.querySelector<HTMLElement>('[data-testid="landing-testimonials-track"]')
  let previousTransform = ''

  if (!track) {
    throw new Error('Missing LandingTestimonials track.')
  }

  await waitFor(
    () => {
      expectVisibleSlidesNotToTouch(canvasElement)

      const currentTransform = track.style.transform

      if (previousTransform === currentTransform) return

      previousTransform = currentTransform
      throw new Error('LandingTestimonials carousel track is still moving.')
    },
    { interval: 100, timeout: 3000 },
  )
}

export const Default: Story = {}

export const CarouselNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const getDots = () => canvas.getAllByRole('button', { name: /^Go to slide \d+ of \d+$/ })

    const dots = getDots()
    await expect(dots.length).toBeGreaterThanOrEqual(2)
    expectDotsToBeTouchFriendly(dots)

    const firstDot = dots[0]!
    const secondDot = dots[1]!
    const lastDot = dots[dots.length - 1]!

    await expect(firstDot).toHaveAttribute('aria-current', 'true')
    await expect(secondDot).not.toHaveAttribute('aria-current')
    expectVisibleSlidesNotToTouch(canvasElement)

    await userEvent.click(secondDot)

    await waitFor(() => {
      const updatedDots = getDots()
      expect(updatedDots[1]).toHaveAttribute('aria-current', 'true')
    })
    await waitForStableCarouselLayout(canvasElement)

    await userEvent.click(lastDot)

    await waitFor(() => {
      const updatedDots = getDots()
      expect(updatedDots[updatedDots.length - 1]).toHaveAttribute('aria-current', 'true')
    })
    await waitForStableCarouselLayout(canvasElement)

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

const mobileSwipeCycleStory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const getDots = () => canvas.getAllByRole('button', { name: /^Go to slide \d+ of \d+$/ })
    const track = canvasElement.querySelector<HTMLElement>('[data-testid="landing-testimonials-track"]')
    const swipeSurface = canvasElement.querySelector<HTMLElement>('[data-testid="landing-testimonials-viewport"]')

    if (!track) {
      throw new Error('Missing mobile swipe track for LandingTestimonials story.')
    }

    if (!swipeSurface) {
      throw new Error('Missing mobile swipe surface for LandingTestimonials story.')
    }

    await waitFor(() => {
      expect(getDots()[0]).toHaveAttribute('aria-current', 'true')
    })

    const firstAuthor = canvas.getByRole('heading', { name: 'Alex Morgan' })
    await expect(firstAuthor).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Nina Feld' })).not.toBeInTheDocument()

    const initialActiveSlide = getActiveSlide(canvasElement)
    await expect(initialActiveSlide).toHaveClass('bg-white')
    expect(initialActiveSlide.className).toContain('border-primary/40')
    expect(initialActiveSlide.className).not.toContain('bg-primary')
    await expect(within(initialActiveSlide).getByTestId('landing-testimonials-active-accent')).toHaveClass(
      'opacity-100',
    )
    const initialSlideRect = initialActiveSlide.getBoundingClientRect()
    const swipeSurfaceRect = swipeSurface.getBoundingClientRect()
    expect(initialSlideRect.left).toBeGreaterThanOrEqual(swipeSurfaceRect.left - 1)
    expect(initialSlideRect.right).toBeLessThanOrEqual(swipeSurfaceRect.right + 1)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)

    dispatchTouch(swipeSurface, 'touchstart', [{ clientX: 260, clientY: 200 }])
    dispatchTouch(swipeSurface, 'touchmove', [{ clientX: 250, clientY: 286 }])
    dispatchTouch(swipeSurface, 'touchend', [{ clientX: 246, clientY: 316 }])
    await waitForStableCarouselLayout(canvasElement)
    expect(getDots()[0]).toHaveAttribute('aria-current', 'true')

    const transformBeforeDrag = track.style.transform

    dispatchTouch(swipeSurface, 'touchstart', [{ clientX: 260, clientY: 200 }])
    dispatchTouch(swipeSurface, 'touchmove', [{ clientX: 160, clientY: 206 }])

    await waitFor(() => {
      expect(track.style.transform).not.toBe(transformBeforeDrag)
    })

    dispatchTouch(swipeSurface, 'touchend', [{ clientX: 110, clientY: 208 }])

    await waitFor(
      () => {
        expect(getDots()[1]).toHaveAttribute('aria-current', 'true')
        expect(canvas.getByRole('heading', { name: 'Nina Feld' })).toBeVisible()
        expect(canvas.queryByRole('heading', { name: 'Alex Morgan' })).not.toBeInTheDocument()
      },
      { timeout: 2500 },
    )
    await waitForStableCarouselLayout(canvasElement)

    dispatchTouch(swipeSurface, 'touchstart', [{ clientX: 96, clientY: 200 }])
    dispatchTouch(swipeSurface, 'touchmove', [{ clientX: 220, clientY: 206 }])
    dispatchTouch(swipeSurface, 'touchmove', [{ clientX: 304, clientY: 208 }])
    dispatchTouch(swipeSurface, 'touchend', [{ clientX: 304, clientY: 208 }])

    await waitFor(
      () => {
        expect(getDots()[0]).toHaveAttribute('aria-current', 'true')
        expect(canvas.getByRole('heading', { name: 'Alex Morgan' })).toBeVisible()
        expect(canvas.queryByRole('heading', { name: 'Nina Feld' })).not.toBeInTheDocument()
      },
      { timeout: 2500 },
    )
    await waitForStableCarouselLayout(canvasElement)
  },
}

export const MobileSingleCardCycle: Story = withViewportStory(mobileSwipeCycleStory, 'public375', 'Mobile Swipe Cycle')

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
export const MobileSingleCardCycle320: Story = withViewportStory(
  mobileSwipeCycleStory,
  'public320',
  'Mobile swipe cycle / 320',
)
export const MobileSingleCardCycle375: Story = withViewportStory(
  mobileSwipeCycleStory,
  'public375',
  'Mobile swipe cycle / 375',
)
