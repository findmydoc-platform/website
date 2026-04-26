import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { ImmersiveVideoHero } from '@/components/molecules/ImmersiveVideoHero'
import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Shared/Molecules/ImmersiveVideoHero',
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
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
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
    playbackRate: 0.78,
    posterSrc: clinicHospitalExterior,
    requiredLabel: 'Background video currently unavailable',
    subheadlineText: 'Compare quality signals before commitment.',
    videoBlurPx: 2.2,
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

export const WithCrossfade320: Story = withViewportStory(WithCrossfade, 'public320', 'With crossfade / 320')
export const WithCrossfade375: Story = withViewportStory(WithCrossfade, 'public375', 'With crossfade / 375')
export const WithCrossfade640: Story = withViewportStory(WithCrossfade, 'public640', 'With crossfade / 640')
export const WithCrossfade768: Story = withViewportStory(WithCrossfade, 'public768', 'With crossfade / 768')
export const WithCrossfade1024: Story = withViewportStory(WithCrossfade, 'public1024', 'With crossfade / 1024')
export const WithCrossfade1280: Story = withViewportStory(WithCrossfade, 'public1280', 'With crossfade / 1280')
export const WithCrossfade320Short: Story = withViewportStory(
  WithCrossfade,
  'public320Short',
  'With crossfade / 320 short',
)
export const WithCrossfade375Short: Story = withViewportStory(
  WithCrossfade,
  'public375Short',
  'With crossfade / 375 short',
)

export const MissingVideo320: Story = withViewportStory(MissingVideo, 'public320', 'Missing video / 320')
export const MissingVideo375: Story = withViewportStory(MissingVideo, 'public375', 'Missing video / 375')
export const MissingVideo640: Story = withViewportStory(MissingVideo, 'public640', 'Missing video / 640')
export const MissingVideo768: Story = withViewportStory(MissingVideo, 'public768', 'Missing video / 768')
export const MissingVideo1024: Story = withViewportStory(MissingVideo, 'public1024', 'Missing video / 1024')
export const MissingVideo1280: Story = withViewportStory(MissingVideo, 'public1280', 'Missing video / 1280')
