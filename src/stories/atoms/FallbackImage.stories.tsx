import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from '@storybook/test'

import { FallbackImage } from '@/components/atoms/FallbackImage'
import medicalHeroImage from '../assets/medical-hero.jpg'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Shared/Atoms/FallbackImage',
  component: FallbackImage,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Small wrapper around `next/image` that swaps to `fallbackSrc` when the primary `src` fails at runtime.',
      },
    },
  },
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable', 'used-in:shared'],
} satisfies Meta<typeof FallbackImage>

export default meta

type Story = StoryObj<typeof meta>

const workingLandscapeBase: Story = {
  name: 'Working landscape',
  args: {
    src: medicalHeroImage,
    fallbackSrc: '/images/blog-placeholder-1600-900.svg',
    alt: 'Working clinic feature image',
  },
  render: (args) => (
    <div className="relative aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-muted">
      <FallbackImage {...args} fill sizes="(max-width: 768px) 100vw, 960px" className="object-cover" />
    </div>
  ),
}

const brokenLandscapeBase: Story = {
  name: 'Broken primary image',
  args: {
    src: '/images/does-not-exist-landscape.jpg',
    fallbackSrc: '/images/blog-placeholder-1600-900.svg',
    alt: 'Broken clinic feature image',
  },
  render: (args) => (
    <div className="relative aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-muted">
      <FallbackImage {...args} fill sizes="(max-width: 768px) 100vw, 960px" className="object-cover" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const image = canvas.getByAltText('Broken clinic feature image')

    await waitFor(() => {
      const src = image.getAttribute('src') ?? ''
      expect(src).toContain('blog-placeholder-1600-900')
    })
  },
}

const brokenAvatarBase: Story = {
  name: 'Broken avatar image',
  args: {
    src: '/images/does-not-exist-avatar.jpg',
    fallbackSrc: '/images/avatar-placeholder.svg',
    alt: 'Broken author avatar',
  },
  render: (args) => (
    <div className="flex items-center gap-4 rounded-3xl border border-border bg-background p-6">
      <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-border">
        <FallbackImage {...args} fill sizes="64px" className="object-cover" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Fallback avatar preview</p>
        <p className="text-sm text-muted-foreground">
          This mirrors the author-avatar degradation path used by blog cards and post hero.
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const image = canvas.getByAltText('Broken author avatar')

    await waitFor(() => {
      const src = image.getAttribute('src') ?? ''
      expect(src).toContain('avatar-placeholder')
    })
  },
}

export const WorkingLandscape: Story = workingLandscapeBase
export const BrokenLandscapeFallback: Story = brokenLandscapeBase
export const BrokenAvatarFallback: Story = brokenAvatarBase

export const WorkingLandscape320: Story = withViewportStory(
  workingLandscapeBase,
  'public320',
  'Working landscape / 320',
)
export const WorkingLandscape375: Story = withViewportStory(
  workingLandscapeBase,
  'public375',
  'Working landscape / 375',
)
export const WorkingLandscape640: Story = withViewportStory(
  workingLandscapeBase,
  'public640',
  'Working landscape / 640',
)
export const WorkingLandscape768: Story = withViewportStory(
  workingLandscapeBase,
  'public768',
  'Working landscape / 768',
)
export const WorkingLandscape1024: Story = withViewportStory(
  workingLandscapeBase,
  'public1024',
  'Working landscape / 1024',
)
export const WorkingLandscape1280: Story = withViewportStory(
  workingLandscapeBase,
  'public1280',
  'Working landscape / 1280',
)

export const BrokenLandscapeFallback320: Story = withViewportStory(
  brokenLandscapeBase,
  'public320',
  'Broken primary image / 320',
)
export const BrokenLandscapeFallback375: Story = withViewportStory(
  brokenLandscapeBase,
  'public375',
  'Broken primary image / 375',
)
export const BrokenLandscapeFallback640: Story = withViewportStory(
  brokenLandscapeBase,
  'public640',
  'Broken primary image / 640',
)
export const BrokenLandscapeFallback768: Story = withViewportStory(
  brokenLandscapeBase,
  'public768',
  'Broken primary image / 768',
)
export const BrokenLandscapeFallback1024: Story = withViewportStory(
  brokenLandscapeBase,
  'public1024',
  'Broken primary image / 1024',
)
export const BrokenLandscapeFallback1280: Story = withViewportStory(
  brokenLandscapeBase,
  'public1280',
  'Broken primary image / 1280',
)

export const BrokenAvatarFallback320: Story = withViewportStory(
  brokenAvatarBase,
  'public320',
  'Broken avatar image / 320',
)
export const BrokenAvatarFallback375: Story = withViewportStory(
  brokenAvatarBase,
  'public375',
  'Broken avatar image / 375',
)
export const BrokenAvatarFallback640: Story = withViewportStory(
  brokenAvatarBase,
  'public640',
  'Broken avatar image / 640',
)
export const BrokenAvatarFallback768: Story = withViewportStory(
  brokenAvatarBase,
  'public768',
  'Broken avatar image / 768',
)
export const BrokenAvatarFallback1024: Story = withViewportStory(
  brokenAvatarBase,
  'public1024',
  'Broken avatar image / 1024',
)
export const BrokenAvatarFallback1280: Story = withViewportStory(
  brokenAvatarBase,
  'public1280',
  'Broken avatar image / 1280',
)
