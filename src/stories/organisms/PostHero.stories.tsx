import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from '@storybook/test'
import { PostHero } from '@/components/organisms/Heroes/PostHero'
import { samplePost } from './fixtures'
import authorAvatar from '../assets/doctor-portrait.jpg'
import postHeroImage from '../assets/post-hero-exam-room.jpg'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Domain/Blog/Organisms/Heroes/PostHero',
  component: PostHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:blog', 'layer:organism', 'status:stable', 'used-in:block:post-hero'],
} satisfies Meta<typeof PostHero>

export default meta

type Story = StoryObj<typeof meta>

export const Complete: Story = {
  args: {
    title: 'Die Zukunft der Zahnmedizin: KI und digitale Diagnostik',
    excerpt:
      'Die Integration von künstlicher Intelligenz und digitalen Technologien verändert die zahnmedizinische Praxis grundlegend und ermöglicht präzisere Diagnosen.',
    categories: ['Zahnmedizin', 'Technologie'],
    author: {
      name: 'Dr. Sarah Weber',
      role: 'Fachzahnärztin für Prothetik',
      avatar: typeof authorAvatar === 'string' ? authorAvatar : authorAvatar.src,
    },
    publishedAt: '2026-01-15T10:00:00.000Z',
    readTime: '8 Min. Lesezeit',
    breadcrumbs: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts' },
      { label: 'Zahnmedizin', href: '/posts?category=zahnmedizin' },
    ],
    image: {
      src: postHeroImage,
      alt: 'Modern dental examination room with diagnostic equipment',
    },
  },
}

export const WithoutExcerpt: Story = {
  args: {
    title: 'Hautpflege im Winter: Expertentipps für gesunde Haut',
    categories: ['Dermatologie'],
    author: {
      name: 'Dr. Michael Klein',
      role: 'Facharzt für Dermatologie',
      avatar: typeof authorAvatar === 'string' ? authorAvatar : authorAvatar.src,
    },
    publishedAt: '2026-01-12T14:30:00.000Z',
    readTime: '6 Min. Lesezeit',
    breadcrumbs: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts' },
      { label: 'Dermatologie', href: '/posts?category=dermatologie' },
    ],
    image: {
      src: postHeroImage,
      alt: 'Dermatology consultation in modern clinic',
    },
  },
}

export const WithoutAuthorAvatar: Story = {
  args: {
    title: 'Präventive Kardiologie: Herzgesundheit langfristig sichern',
    excerpt:
      'Moderne Ansätze zur Vorbeugung von Herz-Kreislauf-Erkrankungen durch gezielte Maßnahmen und regelmäßige Vorsorge.',
    categories: ['Kardiologie'],
    author: {
      name: 'Dr. Lisa Bauer',
      role: 'Fachärztin für Kardiologie',
      // No avatar
    },
    publishedAt: '2026-01-02T09:00:00.000Z',
    readTime: '9 Min. Lesezeit',
    breadcrumbs: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts' },
    ],
    image: {
      src: postHeroImage,
      alt: 'Cardiology examination',
    },
  },
}

export const Minimal: Story = {
  args: {
    title: 'Ernährung und psychische Gesundheit: Der Zusammenhang',
    categories: ['Ernährung'],
    publishedAt: '2026-01-05T10:00:00.000Z',
    image: {
      src: postHeroImage,
      alt: 'Healthy food and nutrition',
    },
  },
}

export const LegacyFormat: Story = {
  name: 'Legacy Format (Backward Compatible)',
  args: {
    title: samplePost.title,
    categories: samplePost.categories
      ?.map((c) => (typeof c === 'object' && c !== null ? c.title : null))
      .filter((t): t is string => typeof t === 'string'),
    authors: 'Dr. Maya Patel', // Old format - still works
    publishedAt: samplePost.publishedAt || undefined,
    image: {
      src: samplePost.heroImage && typeof samplePost.heroImage === 'object' ? samplePost.heroImage.url || '' : '',
      alt: samplePost.heroImage && typeof samplePost.heroImage === 'object' ? samplePost.heroImage.alt || '' : '',
    },
  },
}

const longTitleMobileBase: Story = {
  args: {
    ...Complete.args,
    title: 'How to compare clinics abroad while keeping treatment plans and follow-up care understandable',
    excerpt:
      'A mobile-first stress case for long editorial headlines, category pills, breadcrumbs, author metadata, and dense hero copy.',
    categories: ['Treatment Planning', 'Clinic Comparison', 'Aftercare'],
  },
}

export const LongTitleMobile320: Story = withViewportStory(longTitleMobileBase, 'public320', 'Long title / 320')
export const LongTitleMobile375: Story = withViewportStory(longTitleMobileBase, 'public375', 'Long title / 375')
export const LongTitleMobile640: Story = withViewportStory(longTitleMobileBase, 'public640', 'Long title / 640')
export const LongTitleMobile768: Story = withViewportStory(longTitleMobileBase, 'public768', 'Long title / 768')
export const LongTitleMobile1024: Story = withViewportStory(longTitleMobileBase, 'public1024', 'Long title / 1024')
export const LongTitleMobile1280: Story = withViewportStory(longTitleMobileBase, 'public1280', 'Long title / 1280')
export const LongTitleMobile375Short: Story = withViewportStory(
  longTitleMobileBase,
  'public375Short',
  'Long title / 375 short',
)

const brokenHeroImageBase: Story = {
  args: {
    ...Complete.args,
    title: 'Broken hero images should fall back to the blog placeholder without collapsing the layout',
    image: {
      src: '/images/does-not-exist-post-hero.jpg',
      alt: 'Broken post hero image',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heroImage = canvas.getByAltText('Broken post hero image')

    await waitFor(() => {
      const src = heroImage.getAttribute('src') ?? ''
      expect(src).toContain('blog-placeholder-1600-900')
    })
  },
}

const brokenAuthorAvatarBase: Story = {
  args: {
    ...Complete.args,
    title: 'Broken author avatars should fall back to the shared avatar placeholder',
    author: {
      name: 'Dr. Sarah Weber',
      role: 'Fachzahnärztin für Prothetik',
      avatar: '/images/does-not-exist-post-author.jpg',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const avatarImage = canvas.getByAltText('Dr. Sarah Weber')

    await waitFor(() => {
      const src = avatarImage.getAttribute('src') ?? ''
      expect(src).toContain('avatar-placeholder')
    })
  },
}

export const BrokenHeroImageFallback: Story = brokenHeroImageBase
export const BrokenAuthorAvatarFallback: Story = brokenAuthorAvatarBase

export const BrokenHeroImageFallback320: Story = withViewportStory(
  brokenHeroImageBase,
  'public320',
  'Broken hero image / 320',
)
export const BrokenHeroImageFallback375: Story = withViewportStory(
  brokenHeroImageBase,
  'public375',
  'Broken hero image / 375',
)
export const BrokenHeroImageFallback640: Story = withViewportStory(
  brokenHeroImageBase,
  'public640',
  'Broken hero image / 640',
)
export const BrokenHeroImageFallback768: Story = withViewportStory(
  brokenHeroImageBase,
  'public768',
  'Broken hero image / 768',
)
export const BrokenHeroImageFallback1024: Story = withViewportStory(
  brokenHeroImageBase,
  'public1024',
  'Broken hero image / 1024',
)
export const BrokenHeroImageFallback1280: Story = withViewportStory(
  brokenHeroImageBase,
  'public1280',
  'Broken hero image / 1280',
)

export const BrokenAuthorAvatarFallback320: Story = withViewportStory(
  brokenAuthorAvatarBase,
  'public320',
  'Broken author avatar / 320',
)
export const BrokenAuthorAvatarFallback375: Story = withViewportStory(
  brokenAuthorAvatarBase,
  'public375',
  'Broken author avatar / 375',
)
export const BrokenAuthorAvatarFallback640: Story = withViewportStory(
  brokenAuthorAvatarBase,
  'public640',
  'Broken author avatar / 640',
)
export const BrokenAuthorAvatarFallback768: Story = withViewportStory(
  brokenAuthorAvatarBase,
  'public768',
  'Broken author avatar / 768',
)
export const BrokenAuthorAvatarFallback1024: Story = withViewportStory(
  brokenAuthorAvatarBase,
  'public1024',
  'Broken author avatar / 1024',
)
export const BrokenAuthorAvatarFallback1280: Story = withViewportStory(
  brokenAuthorAvatarBase,
  'public1280',
  'Broken author avatar / 1280',
)
