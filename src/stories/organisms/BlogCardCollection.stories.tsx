import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'
import { withViewportStory } from '../utils/viewportMatrix'
import medicalHeroImage from '../assets/medical-hero.jpg'
import clinicConsultation from '../assets/clinic-consultation.jpg'
import postHeroExamRoom from '../assets/post-hero-exam-room.jpg'
import doctorPortrait from '../assets/doctor-portrait.jpg'
import blogBackground from '../assets/blog-background.jpg'

/**
 * BlogCardCollection Component
 *
 * Section wrapper for displaying a collection of blog posts.
 * Features: 3-column grid, background image support, CTA button.
 *
 * Used on: Homepage blog section
 */
const meta = {
  title: 'Domain/Blog/Organisms/BlogCardCollection',
  component: BlogCardCollection,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:blog', 'layer:organism', 'status:stable', 'used-in:block:blog-card-collection'],
} satisfies Meta<typeof BlogCardCollection>

export default meta

type Story = StoryObj<typeof meta>

const mockPosts: BlogCardBaseProps[] = [
  {
    title: 'Die Zukunft der Telemedizin in Deutschland',
    excerpt: 'Erfahren Sie, wie digitale Gesundheitslösungen die Patientenversorgung revolutionieren.',
    href: '/posts/zukunft-der-telemedizin',
    dateLabel: '15. Januar 2026',
    readTime: '8 Min. Lesezeit',
    category: 'Gesundheitstechnologie',
    image: {
      src: medicalHeroImage.src,
      alt: 'Moderne Telemedizin-Konsultation',
    },
    author: {
      name: 'Dr. med. Sarah Schmidt',
      avatar: doctorPortrait.src,
    },
  },
  {
    title: 'Wie Sie den richtigen Facharzt finden',
    excerpt: 'Praktische Tipps zur Auswahl des besten Spezialisten für Ihre Gesundheitsbedürfnisse.',
    href: '/posts/richtigen-facharzt-finden',
    dateLabel: '12. Januar 2026',
    readTime: '5 Min. Lesezeit',
    category: 'Patientenratgeber',
    image: {
      src: clinicConsultation.src,
      alt: 'Arzt-Patienten-Gespräch',
    },
    author: {
      name: 'Dr. med. Michael Weber',
      avatar: doctorPortrait.src,
    },
  },
  {
    title: 'Präventive Gesundheitsvorsorge: Was Sie wissen müssen',
    excerpt: 'Wichtige Screening-Tests und Vorsorgeuntersuchungen für verschiedene Altersgruppen.',
    href: '/posts/praeventive-gesundheitsvorsorge',
    dateLabel: '8. Januar 2026',
    readTime: '6 Min. Lesezeit',
    category: 'Prävention',
    image: {
      src: postHeroExamRoom.src,
      alt: 'Modernes Untersuchungszimmer',
    },
    author: {
      name: 'Dr. med. Anna Müller',
      avatar: doctorPortrait.src,
    },
  },
]

/**
 * Default Variant
 *
 * White background with 3 blog cards in light variant.
 */
export const Default: Story = {
  args: {
    posts: mockPosts,
    title: 'Latest Articles',
    intro: 'Explore practical insights and expert viewpoints.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Latest Articles' })).toBeInTheDocument()
    await expect(canvas.getByText('Explore practical insights and expert viewpoints.')).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'More Articles' })).toBeInTheDocument()
  },
}

/**
 * Blue Variant
 *
 * Blue background with 3 blog cards in dark variant.
 */
export const BlueVariant: Story = {
  args: {
    ...Default.args,
    variant: 'blue',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Latest Articles' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'More Articles' })).toBeInTheDocument()
  },
}

/**
 * With Background Image
 *
 * Background image with overlay and parallax effect.
 */
export const WithBackground: Story = {
  args: {
    posts: mockPosts,
    title: 'From Our Blog',
    intro: 'Current topics and updates from health and medicine.',
    background: {
      media: {
        src: blogBackground,
        alt: 'Hospital background',
      },
      overlay: {
        kind: 'solid',
        tone: 'backdrop',
        opacity: 60,
      },
      parallax: {
        mode: 'scroll',
        rangePx: 100,
        scale: 1.2,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'From Our Blog' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'More Articles' })).toBeInTheDocument()
  },
}

export const WithBackground320: Story = withViewportStory(WithBackground, 'public320', 'With background / 320')
export const WithBackground375: Story = withViewportStory(WithBackground, 'public375', 'With background / 375')
export const WithBackground640: Story = withViewportStory(WithBackground, 'public640', 'With background / 640')
export const WithBackground768: Story = withViewportStory(WithBackground, 'public768', 'With background / 768')
export const WithBackground1024: Story = withViewportStory(WithBackground, 'public1024', 'With background / 1024')
export const WithBackground1280: Story = withViewportStory(WithBackground, 'public1280', 'With background / 1280')
