import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'

import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { ScrollReveal } from '@/components/molecules/ScrollReveal'
import { withViewportStory } from '../utils/viewportMatrix'

const createMatchMedia = (prefersReducedMotion: boolean): typeof window.matchMedia => {
  return ((query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: query.includes('prefers-reduced-motion') ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  })) as typeof window.matchMedia
}

const meta = {
  title: 'Shared/Molecules/ScrollReveal',
  component: ScrollReveal,
  parameters: {
    demoFrame: { maxWidth: 'full', padded: false },
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Client-side section reveal wrapper for below-the-fold landing content. Reveals once on first entry and disables motion when reduced motion is preferred.',
      },
    },
  },
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
  args: {
    children: null,
  },
} satisfies Meta<typeof ScrollReveal>

export default meta

type Story = StoryObj<typeof meta>

const RevealStoryPage = () => {
  return (
    <div className="bg-slate-50 text-slate-950">
      <Container className="py-24">
        <Heading as="h2" align="left" className="text-4xl font-semibold text-foreground">
          Scroll down
        </Heading>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          This spacer keeps the reveal target below the fold so the story can verify the one-time entrance animation.
        </p>
      </Container>

      <div className="h-[82vh]" aria-hidden="true" />

      <ScrollReveal preset="section">
        <section className="bg-white py-20 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.35)]">
          <Container>
            <Heading as="h2" align="left" className="text-4xl font-semibold text-foreground">
              Reveal target
            </Heading>
            <p className="mt-4 max-w-2xl text-lg text-slate-600">
              This section fades and lifts into place the first time it crosses the scroll trigger.
            </p>
          </Container>
        </section>
      </ScrollReveal>

      <div className="h-[70vh]" aria-hidden="true" />
    </div>
  )
}

const ReducedMotionPreview = () => {
  const [isReady, setIsReady] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const originalMatchMedia = window.matchMedia
    window.matchMedia = createMatchMedia(true)
    setIsReady(true)

    return () => {
      window.matchMedia = originalMatchMedia
    }
  }, [])

  if (!isReady) return null

  return (
    <ScrollReveal preset="surface">
      <section className="bg-white py-20 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.35)]">
        <Container>
          <Heading as="h2" align="left" className="text-4xl font-semibold text-foreground">
            Reduced motion target
          </Heading>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            When reduced motion is preferred, the content stays immediately visible and no scroll trigger is registered.
          </p>
        </Container>
      </section>
    </ScrollReveal>
  )
}

export const Default: Story = {
  render: () => <RevealStoryPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = await canvas.findByRole('heading', { name: /reveal target/i })
    const root = heading.closest<HTMLElement>('[data-scroll-reveal-root]')

    expect(root).not.toBeNull()
    if (!root) return

    await waitFor(() => {
      expect(root.dataset.scrollRevealState).toBe('hidden')
    })

    root.scrollIntoView({ behavior: 'auto', block: 'center' })

    await waitFor(() => {
      expect(root.dataset.scrollRevealState).toBe('visible')
    })
  },
}

export const ReducedMotionFallback: Story = {
  render: () => <ReducedMotionPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = await canvas.findByRole('heading', { name: /reduced motion target/i })
    const root = heading.closest<HTMLElement>('[data-scroll-reveal-root]')

    expect(root).not.toBeNull()
    if (!root) return

    await waitFor(() => {
      expect(root.dataset.scrollRevealMode).toBe('reduced')
      expect(root.dataset.scrollRevealState).toBe('visible')
    })
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
