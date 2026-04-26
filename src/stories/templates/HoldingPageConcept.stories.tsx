import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'

import { HoldingPageConcept } from '@/components/templates/HoldingPageConcept'
import { holdingPageConcept } from '@/stories/fixtures/holdingPageConcepts'
import { createMockFetchDecorator } from '../utils/fetchDecorator'
import { createDelayedJsonResponse } from '../utils/mockHelpers'
import { withViewportStory } from '../utils/viewportMatrix'

const mockFetch: typeof fetch = async () => createDelayedJsonResponse({ success: true })

const meta = {
  title: 'Internal/Landing/Templates/HoldingPageConcept',
  component: HoldingPageConcept,
  decorators: [createMockFetchDecorator(mockFetch)],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'This story documents the Findmydoc production holding landing page concept.',
          '',
          'Purpose:',
          '- Provide a premium, brand-consistent placeholder homepage while the platform is not fully public yet.',
          '- Reduce go-live risk by validating messaging, trust cues, legal links, and contact capture before switching the real homepage on.',
          '',
          'How it is intended to be used in production:',
          '- A feature flag/environment toggle enables the holding page for production traffic until launch.',
          '- When the toggle is turned off, the full site becomes the default experience.',
          '',
          'What the holding page must communicate:',
          '- Comparison-first positioning: visitors should immediately understand that Findmydoc helps compare clinics abroad.',
          '- Trust signals: emphasize verified quality information (ratings, reviews, verification, accreditations) without overclaiming.',
          '- A clear next step: capture contact intent with a simple message form.',
          '- Legal clarity: always keep Privacy Policy and Imprint visible.',
          '',
          'Hero video template notes:',
          '- The hero is intentionally dominant (near fullscreen) to create a calm, premium first impression.',
          '- If a `heroVideo.videoSrc` is missing, the UI shows a visible placeholder to prevent silent regressions.',
          '- The final video asset can be swapped without changing layout or copy.',
          '',
          'Context:',
          '- This direction was designed as a light (white) page system, not a dark landing page.',
          '- Copy is written to be production-ready and aligned with the existing SEO style for Findmydoc (comparison, trust, cross-border care).',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs', 'domain:landing', 'layer:template', 'status:experimental', 'used-in:shared'],
  args: holdingPageConcept,
} satisfies Meta<typeof HoldingPageConcept>

export default meta

type Story = StoryObj<typeof meta>

const mobileStressArgs = {
  ...holdingPageConcept,
  contactDescription:
    'Use this contact form to send us a direct request. Include a short title, your message, and your email so we can reply with launch timing and first-access details.',
  footerLinks: holdingPageConcept.footerLinks.map((link, index) =>
    index === 0 ? { ...link, label: 'Contact and launch updates' } : link,
  ),
  primaryCtaLabel: 'Request early access',
} satisfies typeof holdingPageConcept

const assertConceptFrame: Story['play'] = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement)

  await expect(canvas.getByRole('heading', { name: String(args.title) })).toBeInTheDocument()
  await expect(canvas.getAllByRole('button', { name: String(args.primaryCtaLabel) }).length).toBeGreaterThanOrEqual(1)
  await expect(canvas.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument()
  await expect(canvas.getByRole('link', { name: 'Imprint' })).toBeInTheDocument()
  await expect(canvas.getByLabelText('Email')).toBeInTheDocument()
  await expect(canvas.getByText('Why findmydoc')).toBeInTheDocument()
  await expect(canvas.getByText('What you get')).toBeInTheDocument()

  if (args.contactMode === 'compact') {
    await expect(canvas.queryByLabelText('Name')).not.toBeInTheDocument()
    await expect(canvas.queryByLabelText('Message')).not.toBeInTheDocument()
  } else {
    await expect(canvas.getByLabelText('Name')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Message')).toBeInTheDocument()
  }

  await expect(canvas.getByTestId('immersive-video-hero')).toBeInTheDocument()

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  const useReducedMotionFallback = args.heroVideo?.useReducedMotionFallback ?? true
  const withCrossfade = args.heroVideo?.withCrossfade ?? true
  const expectedPlaybackRate = (args.heroVideo?.playbackRate ?? 1).toFixed(2)

  if (!args.heroVideo?.videoSrc) {
    await expect(canvas.getByTestId('hero-video-placeholder')).toBeInTheDocument()
    return
  }

  if (prefersReducedMotion && useReducedMotionFallback) {
    await expect(canvas.getByTestId('hero-video-reduced-motion-fallback')).toBeInTheDocument()
    await expect(canvas.queryByTestId('hero-video-layer-a')).not.toBeInTheDocument()
    await expect(canvas.queryByTestId('hero-video-layer-b')).not.toBeInTheDocument()
    await expect(canvas.queryByTestId('hero-video-native')).not.toBeInTheDocument()
    return
  }

  if (withCrossfade) {
    const layerA = canvas.getByTestId('hero-video-layer-a')
    const layerB = canvas.getByTestId('hero-video-layer-b')

    await expect(layerA).toBeInTheDocument()
    await expect(layerB).toBeInTheDocument()
    await expect(layerA.getAttribute('data-video-source')).toBe(layerB.getAttribute('data-video-source'))
    await expect(layerA.getAttribute('data-video-source')).toBe(args.heroVideo.videoSrc)
    await expect(layerA.getAttribute('data-video-playback-rate')).toBe(expectedPlaybackRate)
    await expect(layerB.getAttribute('data-video-playback-rate')).toBe(expectedPlaybackRate)
    await expect(canvas.queryByTestId('hero-video-native')).not.toBeInTheDocument()
  } else {
    const nativeVideo = canvas.getByTestId('hero-video-native')
    await expect(nativeVideo).toBeInTheDocument()
    await expect(nativeVideo.getAttribute('data-video-source')).toBe(args.heroVideo.videoSrc)
    await expect(nativeVideo.getAttribute('data-video-playback-rate')).toBe(expectedPlaybackRate)
    await expect(canvas.queryByTestId('hero-video-layer-a')).not.toBeInTheDocument()
    await expect(canvas.queryByTestId('hero-video-layer-b')).not.toBeInTheDocument()
  }
}

export const HoldingPage: Story = {
  args: holdingPageConcept,
  play: assertConceptFrame,
}

export const MobileStress: Story = {
  args: mobileStressArgs,
  play: assertConceptFrame,
}

const mobileStressSubmitBase: Story = {
  args: mobileStressArgs,
  play: async ({ args, canvasElement }) => {
    await assertConceptFrame({ args, canvasElement } as Parameters<NonNullable<Story['play']>>[0])

    const canvas = within(canvasElement)
    const heroCta = canvas.getByRole('link', { name: String(args.primaryCtaLabel) })

    await userEvent.click(heroCta)
    await waitFor(() => {
      expect(window.location.hash).toBe('#contact')
    })

    if (window.innerWidth >= 640) {
      await userEvent.click(canvas.getByRole('link', { name: 'Scroll down' }))
      await waitFor(() => {
        expect(window.location.hash).toBe('#landing-content-start')
      })
    }

    await userEvent.click(canvas.getByRole('button', { name: String(args.primaryCtaLabel) }))

    await waitFor(() => {
      expect(canvas.getByText('Email is required.')).toBeInTheDocument()
    })

    await userEvent.type(canvas.getByLabelText('Name'), 'Taylor Brooks')
    await userEvent.type(canvas.getByLabelText('Email'), 'taylor@findmydoc.com')
    await userEvent.type(
      canvas.getByLabelText('Message'),
      'Please keep me updated about the launch timeline and early access options.',
    )

    await userEvent.click(canvas.getByRole('button', { name: String(args.primaryCtaLabel) }))

    await waitFor(() => {
      expect(canvas.getByText('Your request has been sent successfully.')).toBeInTheDocument()
    })
  },
}

export const MobileStress320: Story = withViewportStory(mobileStressSubmitBase, 'public320', 'Mobile stress / 320')
export const MobileStress375: Story = withViewportStory(mobileStressSubmitBase, 'public375', 'Mobile stress / 375')
export const MobileStress640: Story = withViewportStory(mobileStressSubmitBase, 'public640', 'Mobile stress / 640')
export const MobileStress768: Story = withViewportStory(mobileStressSubmitBase, 'public768', 'Mobile stress / 768')
export const MobileStress1024: Story = withViewportStory(mobileStressSubmitBase, 'public1024', 'Mobile stress / 1024')
export const MobileStress1280: Story = withViewportStory(mobileStressSubmitBase, 'public1280', 'Mobile stress / 1280')
export const MobileStress320Short: Story = withViewportStory(
  mobileStressSubmitBase,
  'public320Short',
  'Mobile stress / 320 short',
)
export const MobileStress375Short: Story = withViewportStory(
  mobileStressSubmitBase,
  'public375Short',
  'Mobile stress / 375 short',
)
