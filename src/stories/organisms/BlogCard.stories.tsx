import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from '@storybook/test'

import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'
import { getStoryImageSrc, storyClinicImages, storyPortraits } from '../fixtures/assets'
import { withViewportStory } from '../utils/viewportMatrix'

/**
 * BlogCard Compound Components
 *
 * Four specialized variants for different layout contexts:
 * - Overlay: Featured card with 21:9 aspect ratio for blog listing hero
 * - Simple: Grid card with 4:3 aspect ratio for blog listing grid
 * - Enhanced: Homepage card with author info (light/dark variants)
 * - Overview: Compact card with 16:10 aspect ratio for related posts
 */
const meta = {
  title: 'Domain/Blog/Organisms/BlogCard',
  component: BlogCard.Simple,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs', 'domain:blog', 'layer:organism', 'status:stable', 'used-in:block:blog-card'],
} satisfies Meta<typeof BlogCard.Simple>

export default meta

type Story = StoryObj<typeof meta>

const expectElementContained = (element: HTMLElement, container: HTMLElement) => {
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  expect(elementRect.left).toBeGreaterThanOrEqual(containerRect.left - 1)
  expect(elementRect.right).toBeLessThanOrEqual(containerRect.right + 1)
}

const mockPost: BlogCardBaseProps = {
  title: 'Die Zukunft der Telemedizin in Deutschland',
  excerpt:
    'Erfahren Sie, wie digitale Gesundheitslösungen die Patientenversorgung revolutionieren und welche Vorteile Telemedizin für Ärzte und Patienten bietet.',
  href: '/posts/zukunft-der-telemedizin',
  dateLabel: '15. Januar 2026',
  readTime: '8 Min. Lesezeit',
  category: 'Gesundheitstechnologie',
  image: {
    src: getStoryImageSrc(storyClinicImages.blog.diagnostics),
    alt: 'Moderne Telemedizin-Konsultation',
  },
  author: {
    name: 'Dr. med. Sarah Schmidt',
    avatar: getStoryImageSrc(storyPortraits.doctor),
  },
}

const denseOverlayPost: BlogCardBaseProps = {
  ...mockPost,
  title: 'Cardiology diagnostics abroad: reading your results with confidence',
  excerpt:
    'Know what to ask about ECGs, imaging notes, lab references, and follow-up planning so you return home with clear next steps.',
  href: '/posts/cardiology-diagnostics-reading-results',
  dateLabel: '28. Januar 2026',
  category: 'International cardiology diagnostics and imaging results guidance',
  image: {
    src: getStoryImageSrc(storyClinicImages.blog.diagnostics),
    alt: 'Cardiology diagnostics monitor',
  },
  author: {
    name: 'Seed Admin International Care Coordination',
    avatar: getStoryImageSrc(storyPortraits.accountMenuAvatar),
  },
}

const denseSimplePost: BlogCardBaseProps = {
  ...denseOverlayPost,
  href: '/posts/dense-simple-cardiology-diagnostics',
  image: {
    src: getStoryImageSrc(storyClinicImages.blog.consultation),
    alt: 'International clinic consultation',
  },
}

/**
 * Overlay Variant
 *
 * Featured card with full-bleed image (21:9 aspect ratio).
 * Used as hero card on blog listing page.
 * Features: gradient overlay, category badge top-left, large title.
 */
export const Overlay: StoryObj<typeof BlogCard.Overlay> = {
  render: (args) => (
    <div style={{ maxWidth: '1200px' }}>
      <BlogCard.Overlay {...args} />
    </div>
  ),
  args: mockPost,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Die Zukunft der Telemedizin in Deutschland' })).toBeInTheDocument()
    await expect(canvas.getByText('Die Zukunft der Telemedizin in Deutschland')).toBeInTheDocument()
    await expect(canvas.getByText('Gesundheitstechnologie')).toBeInTheDocument()
    await expect(canvas.getByText('Dr. med. Sarah Schmidt')).toBeInTheDocument()
  },
}

export const DenseOverlay: StoryObj<typeof BlogCard.Overlay> = {
  render: (args) => (
    <div style={{ maxWidth: '1200px' }}>
      <BlogCard.Overlay {...args} />
    </div>
  ),
  args: denseOverlayPost,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = canvas.getByRole('link', {
      name: 'Cardiology diagnostics abroad: reading your results with confidence',
    })
    await expect(link).toBeInTheDocument()
    await expect(
      canvas.getByText('Cardiology diagnostics abroad: reading your results with confidence'),
    ).toBeInTheDocument()
    await expect(
      canvas.getByText('International cardiology diagnostics and imaging results guidance'),
    ).toBeInTheDocument()
    await expect(canvas.getByText('Seed Admin International Care Coordination')).toBeInTheDocument()
    expectElementContained(canvas.getByText('International cardiology diagnostics and imaging results guidance'), link)
    expectElementContained(canvas.getByText('Seed Admin International Care Coordination'), link)
  },
}

/**
 * Simple Variant
 *
 * Grid card with minimal design (4:3 aspect ratio).
 * Used in blog listing page grid (3 columns).
 * Features: category badge top-right, border-top author row.
 */
export const Simple: Story = {
  render: (args) => (
    <div style={{ maxWidth: '400px' }}>
      <BlogCard.Simple {...args} />
    </div>
  ),
  args: {
    ...mockPost,
    image: {
      src: getStoryImageSrc(storyClinicImages.blog.consultation),
      alt: 'Klinik Beratungsgespräch',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Die Zukunft der Telemedizin in Deutschland' })).toBeInTheDocument()
    await expect(canvas.getByText('Die Zukunft der Telemedizin in Deutschland')).toBeInTheDocument()
    await expect(canvas.getByText('15. Januar 2026')).toBeInTheDocument()
  },
}

export const DenseSimple: Story = {
  render: (args) => (
    <div style={{ maxWidth: '400px' }}>
      <BlogCard.Simple {...args} />
    </div>
  ),
  args: denseSimplePost,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = canvas.getByRole('link', {
      name: 'Cardiology diagnostics abroad: reading your results with confidence',
    })

    await expect(link).toBeInTheDocument()
    await expect(
      canvas.getByText('International cardiology diagnostics and imaging results guidance'),
    ).toBeInTheDocument()
    await expect(canvas.getByText('Seed Admin International Care Coordination')).toBeInTheDocument()
    expectElementContained(canvas.getByText('International cardiology diagnostics and imaging results guidance'), link)
    expectElementContained(canvas.getByText('Seed Admin International Care Coordination'), link)
  },
}

/**
 * Enhanced Light Variant
 *
 * Homepage card with author info on white background (4:3 aspect ratio).
 * Features: author avatar with ring, arrow icon animation.
 */
export const EnhancedLight: StoryObj<typeof BlogCard.Enhanced> = {
  render: (args) => (
    <div style={{ maxWidth: '400px' }}>
      <BlogCard.Enhanced {...args} />
    </div>
  ),
  args: {
    ...mockPost,
    variant: 'light',
    image: {
      src: getStoryImageSrc(storyClinicImages.blog.postHeroExamRoom),
      alt: 'Modernes Untersuchungszimmer',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link')).toBeInTheDocument()
    await expect(canvas.getByText('Dr. med. Sarah Schmidt')).toBeInTheDocument()
  },
}

/**
 * Enhanced Dark Variant
 *
 * Homepage card with author info on blue/dark background (4:3 aspect ratio).
 * Features: white text, author avatar with white ring.
 */
export const EnhancedDark: StoryObj<typeof BlogCard.Enhanced> = {
  render: (args) => (
    <div style={{ maxWidth: '400px', padding: '2rem', backgroundColor: '#2563eb' }}>
      <BlogCard.Enhanced {...args} />
    </div>
  ),
  args: {
    ...mockPost,
    variant: 'dark',
    image: {
      src: getStoryImageSrc(storyClinicImages.blog.consultation),
      alt: 'Klinik Beratungsgespräch',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link')).toBeInTheDocument()
    await expect(canvas.getByText('Dr. med. Sarah Schmidt')).toBeInTheDocument()
  },
}

/**
 * Overview Variant
 *
 * Compact card for related posts section (16:10 aspect ratio).
 * Features: category pill below image, meta with Calendar/Clock icons.
 */
export const Overview: StoryObj<typeof BlogCard.Overview> = {
  render: (args) => (
    <div style={{ maxWidth: '400px' }}>
      <BlogCard.Overview {...args} />
    </div>
  ),
  args: {
    ...mockPost,
    title: 'Wie Sie den richtigen Facharzt finden',
    excerpt: 'Praktische Tipps zur Auswahl des besten Spezialisten für Ihre Gesundheitsbedürfnisse.',
    category: 'Patientenratgeber',
    image: {
      src: getStoryImageSrc(storyClinicImages.blog.postHeroExamRoom),
      alt: 'Arzt-Patienten-Gespräch',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link')).toBeInTheDocument()
    await expect(canvas.getByText('Wie Sie den richtigen Facharzt finden')).toBeInTheDocument()
    await expect(canvas.getByText('Patientenratgeber')).toBeInTheDocument()
  },
}

const fallbackOverlayBase: StoryObj<typeof BlogCard.Overlay> = {
  render: (args) => (
    <div style={{ maxWidth: '1200px' }}>
      <BlogCard.Overlay {...args} />
    </div>
  ),
  args: {
    ...mockPost,
    title: 'Fallback avatar keeps the featured card stable when author avatar URLs break',
    author: {
      name: 'Dr. med. Sarah Schmidt',
      avatar: '/images/does-not-exist-author-avatar.jpg',
    },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const authorAvatar = Array.from(canvasElement.querySelectorAll('img')).find((image) => {
        const imageSrc = image.getAttribute('src') ?? ''
        return imageSrc.includes('author-avatar') || imageSrc.includes('avatar-placeholder')
      })
      const avatarSrc = authorAvatar?.getAttribute('src') ?? ''
      expect(avatarSrc).toContain('avatar-placeholder')
    })
  },
}

export const FallbackOverlay: StoryObj<typeof BlogCard.Overlay> = fallbackOverlayBase

export const Overlay320: StoryObj<typeof BlogCard.Overlay> = withViewportStory(Overlay, 'public320', 'Overlay / 320')
export const Overlay375: StoryObj<typeof BlogCard.Overlay> = withViewportStory(Overlay, 'public375', 'Overlay / 375')
export const Overlay640: StoryObj<typeof BlogCard.Overlay> = withViewportStory(Overlay, 'public640', 'Overlay / 640')
export const Overlay768: StoryObj<typeof BlogCard.Overlay> = withViewportStory(Overlay, 'public768', 'Overlay / 768')
export const Overlay1024: StoryObj<typeof BlogCard.Overlay> = withViewportStory(Overlay, 'public1024', 'Overlay / 1024')
export const Overlay1280: StoryObj<typeof BlogCard.Overlay> = withViewportStory(Overlay, 'public1280', 'Overlay / 1280')

export const DenseOverlay320: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  DenseOverlay,
  'public320',
  'Dense overlay / 320',
)
export const DenseOverlay375: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  DenseOverlay,
  'public375',
  'Dense overlay / 375',
)
export const DenseOverlay640: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  DenseOverlay,
  'public640',
  'Dense overlay / 640',
)
export const DenseOverlay768: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  DenseOverlay,
  'public768',
  'Dense overlay / 768',
)
export const DenseOverlay1024: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  DenseOverlay,
  'public1024',
  'Dense overlay / 1024',
)
export const DenseOverlay1280: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  DenseOverlay,
  'public1280',
  'Dense overlay / 1280',
)

export const FallbackOverlay320: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  fallbackOverlayBase,
  'public320',
  'Fallback overlay / 320',
)
export const FallbackOverlay375: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  fallbackOverlayBase,
  'public375',
  'Fallback overlay / 375',
)
export const FallbackOverlay640: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  fallbackOverlayBase,
  'public640',
  'Fallback overlay / 640',
)
export const FallbackOverlay768: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  fallbackOverlayBase,
  'public768',
  'Fallback overlay / 768',
)
export const FallbackOverlay1024: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  fallbackOverlayBase,
  'public1024',
  'Fallback overlay / 1024',
)
export const FallbackOverlay1280: StoryObj<typeof BlogCard.Overlay> = withViewportStory(
  fallbackOverlayBase,
  'public1280',
  'Fallback overlay / 1280',
)

export const Simple320: Story = withViewportStory(Simple, 'public320', 'Simple / 320')
export const Simple375: Story = withViewportStory(Simple, 'public375', 'Simple / 375')
export const Simple640: Story = withViewportStory(Simple, 'public640', 'Simple / 640')
export const Simple768: Story = withViewportStory(Simple, 'public768', 'Simple / 768')
export const Simple1024: Story = withViewportStory(Simple, 'public1024', 'Simple / 1024')
export const Simple1280: Story = withViewportStory(Simple, 'public1280', 'Simple / 1280')

export const DenseSimple320: Story = withViewportStory(DenseSimple, 'public320', 'Dense simple / 320')
export const DenseSimple375: Story = withViewportStory(DenseSimple, 'public375', 'Dense simple / 375')
export const DenseSimple640: Story = withViewportStory(DenseSimple, 'public640', 'Dense simple / 640')
export const DenseSimple768: Story = withViewportStory(DenseSimple, 'public768', 'Dense simple / 768')
export const DenseSimple1024: Story = withViewportStory(DenseSimple, 'public1024', 'Dense simple / 1024')
export const DenseSimple1280: Story = withViewportStory(DenseSimple, 'public1280', 'Dense simple / 1280')

export const Overview320: StoryObj<typeof BlogCard.Overview> = withViewportStory(
  Overview,
  'public320',
  'Overview / 320',
)
export const Overview375: StoryObj<typeof BlogCard.Overview> = withViewportStory(
  Overview,
  'public375',
  'Overview / 375',
)
export const Overview640: StoryObj<typeof BlogCard.Overview> = withViewportStory(
  Overview,
  'public640',
  'Overview / 640',
)
export const Overview768: StoryObj<typeof BlogCard.Overview> = withViewportStory(
  Overview,
  'public768',
  'Overview / 768',
)
export const Overview1024: StoryObj<typeof BlogCard.Overview> = withViewportStory(
  Overview,
  'public1024',
  'Overview / 1024',
)
export const Overview1280: StoryObj<typeof BlogCard.Overview> = withViewportStory(
  Overview,
  'public1280',
  'Overview / 1280',
)
