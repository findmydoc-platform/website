import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { ImmersiveVideoHero } from '@/components/molecules/ImmersiveVideoHero'
import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'

const meta = {
  title: 'Molecules/ImmersiveVideoHero',
  component: ImmersiveVideoHero,
  parameters: {
    demoFrame: false,
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Reusable immersive video hero with optional dual crossfade, four optional text slots, and optional CTA target.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    ctaHref: '#contact',
    ctaLabel: 'Join launch updates',
    crossfadeMs: 700,
    descriptionText:
      'Findmydoc is launching a clearer way to compare clinics abroad. This hero keeps motion premium while preserving readability.',
    eyebrowText: 'Trusted treatment decisions start with transparent comparison',
    fallbackImageSrc: clinicHospitalExterior,
    headlineText: 'A new way to compare clinics abroad starts here.',
    mediaAlt: 'Medical consultation background video',
    playbackRate: 0.88,
    posterSrc: clinicHospitalExterior,
    requiredLabel: 'Background video currently unavailable',
    subheadlineText: 'Compare quality signals before commitment.',
    useReducedMotionFallback: true,
    videoUrl: '/stories/immersive-hero-loop.mp4',
    withCrossfade: true,
  },
} satisfies Meta<typeof ImmersiveVideoHero>

export default meta

type Story = StoryObj<typeof meta>

const assertBaseHero: Story['play'] = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement)

  if (args.headlineText) {
    await expect(canvas.getByRole('heading', { name: String(args.headlineText) })).toBeInTheDocument()
  }

  if (args.ctaLabel && args.ctaHref) {
    await expect(canvas.getByRole('link', { name: String(args.ctaLabel) })).toHaveAttribute(
      'href',
      String(args.ctaHref),
    )
  } else if (args.ctaLabel) {
    await expect(canvas.queryByRole('button', { name: String(args.ctaLabel) })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('link', { name: String(args.ctaLabel) })).not.toBeInTheDocument()
  }
}

export const WithCrossfade: Story = {
  play: async (context) => {
    await assertBaseHero(context)
    const canvas = within(context.canvasElement)
    const layerA = canvas.getByTestId('hero-video-layer-a')
    const layerB = canvas.getByTestId('hero-video-layer-b')
    await expect(layerA).toBeInTheDocument()
    await expect(layerB).toBeInTheDocument()
    await expect(layerA.getAttribute('data-video-source')).toBe(layerB.getAttribute('data-video-source'))
  },
}

export const WithoutCrossfade: Story = {
  args: {
    withCrossfade: false,
  },
  play: async (context) => {
    await assertBaseHero(context)
    const canvas = within(context.canvasElement)
    const nativeVideo = canvas.getByTestId('hero-video-native')
    await expect(nativeVideo).toBeInTheDocument()
    await expect(canvas.queryByTestId('hero-video-layer-a')).not.toBeInTheDocument()
    await expect(canvas.queryByTestId('hero-video-layer-b')).not.toBeInTheDocument()
  },
}

export const WithoutButton: Story = {
  args: {
    ctaHref: undefined,
    ctaLabel: 'Join launch updates',
  },
  play: async (context) => {
    await assertBaseHero(context)
  },
}

export const MissingVideo: Story = {
  args: {
    videoUrl: '',
  },
  play: async (context) => {
    await assertBaseHero(context)
    const canvas = within(context.canvasElement)
    await expect(canvas.getByTestId('hero-video-placeholder')).toBeInTheDocument()
  },
}
