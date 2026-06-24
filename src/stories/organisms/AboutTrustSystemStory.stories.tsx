import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'

import { AboutTrustSystemStory } from '@/components/organisms/AboutTrustSystemStory'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Domain/Landing/Organisms/AboutTrustSystemStory',
  component: AboutTrustSystemStory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Isolated trust-system scroll story used inside the About page template. Stories cover fixed progress states and scroll behavior separately from the route shell.',
      },
    },
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:experimental', 'used-in:route:/about'],
} satisfies Meta<typeof AboutTrustSystemStory>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    fixedProgress: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const story = canvas.getByTestId('about-trust-system-story')
    const firstCard = story.querySelector<HTMLElement>('[data-card="0"]')

    await expect(canvas.getByRole('region', { name: /findmydoc trust system scroll story/i })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Patients start with uncertainty.' })).toBeInTheDocument()
    await expect(
      canvas.getByRole('heading', { name: 'We turn trust signals into clearer decisions.' }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole('heading', { name: 'A clearer path forward for patients and clinics.' }),
    ).toBeInTheDocument()
    expect(canvas.getAllByText(/Choosing care abroad often means piecing together clinics/i).length).toBeGreaterThan(0)
    expect(
      canvas.getAllByText(/findmydoc organizes provider information into comparable signals/i).length,
    ).toBeGreaterThan(0)
    expect(canvas.getAllByText(/Patients can understand their options with more confidence/i).length).toBeGreaterThan(0)
    expect(canvas.getAllByText(/This is why we build findmydoc/i).length).toBeGreaterThan(0)
    expect(canvas.getAllByText(/To make trust easier to understand before care begins/i).length).toBeGreaterThan(0)
    expect(canvas.getAllByText(/Patient\s*Confidence/).length).toBeGreaterThan(0)
    expect(canvas.getAllByText(/Trust at the core/i).length).toBeGreaterThan(0)
    await expect(canvas.queryByText(/Reusable argumentation/i)).not.toBeInTheDocument()
    expect(canvas.getAllByRole('heading', { name: 'Patients start with uncertainty.' })).toHaveLength(1)
    expect(canvas.getAllByRole('listitem')).toHaveLength(6)
    expect(firstCard).not.toBeNull()
    if (!firstCard) return

    await expect(within(firstCard).getByText('Patients start with uncertainty.')).toBeInTheDocument()
    await expect(within(firstCard).getByText(/Choosing care abroad often means/i)).toBeInTheDocument()
    await expect(firstCard).toHaveAttribute('data-active', 'true')
  },
}

export const FinalRing: Story = {
  args: {
    fixedProgress: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const story = canvas.getByTestId('about-trust-system-story')
    const finalCard = story.querySelector<HTMLElement>('[data-card="2"]')
    const finalLabel = story.querySelector<HTMLElement>('[data-ring-label="2"]')
    const progressBar = story.querySelector<HTMLElement>('[data-progress-bar]')

    await expect(finalCard).toHaveAttribute('data-active', 'true')
    await expect(finalLabel).toHaveAttribute('data-visible')
    expect(Number.parseFloat(progressBar?.style.width ?? '0')).toBe(100)
  },
}

export const ScrollBehavior: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const story = canvas.getByTestId('about-trust-system-story')
    const win = canvasElement.ownerDocument.defaultView
    const firstCard = story.querySelector<HTMLElement>('[data-card="0"]')
    const secondCard = story.querySelector<HTMLElement>('[data-card="1"]')
    const finalCard = story.querySelector<HTMLElement>('[data-card="2"]')
    const finalLabel = story.querySelector<HTMLElement>('[data-ring-label="2"]')
    const progressBar = story.querySelector<HTMLElement>('[data-progress-bar]')

    expect(win).not.toBeNull()
    expect(firstCard).not.toBeNull()
    expect(secondCard).not.toBeNull()
    expect(finalCard).not.toBeNull()
    expect(finalLabel).not.toBeNull()
    expect(progressBar).not.toBeNull()

    if (!win || !firstCard || !secondCard || !finalCard || !finalLabel || !progressBar) return

    const originalScrollY = win.scrollY
    const storyTop = win.scrollY + story.getBoundingClientRect().top
    const maxScroll = Math.max(1, story.offsetHeight - win.innerHeight)
    const nextFrames = () =>
      new Promise<void>((resolve) => {
        win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()))
      })

    try {
      win.scrollTo(0, storyTop)
      win.dispatchEvent(new win.Event('scroll'))
      await nextFrames()
      await expect(firstCard).toHaveAttribute('data-active', 'true')

      win.scrollTo(0, storyTop + maxScroll * 0.46)
      win.dispatchEvent(new win.Event('scroll'))

      await waitFor(() => expect(secondCard).toHaveAttribute('data-active', 'true'))

      win.scrollTo(0, storyTop + maxScroll * 0.96)
      win.dispatchEvent(new win.Event('scroll'))

      await waitFor(() => expect(finalCard).toHaveAttribute('data-active', 'true'))
      await waitFor(() => expect(finalLabel).toHaveAttribute('data-visible'))
      expect(Number.parseFloat(progressBar.style.width)).toBeGreaterThan(90)
    } finally {
      win.scrollTo(0, originalScrollY)
      win.dispatchEvent(new win.Event('scroll'))
    }
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')
export const Default320Short: Story = withViewportStory(Default, 'public320Short', 'Default / 320 short')
export const Default375Short: Story = withViewportStory(Default, 'public375Short', 'Default / 375 short')
