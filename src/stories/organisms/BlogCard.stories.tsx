import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'
import medicalHeroImage from '@/stories/assets/medical-hero.jpg'
import clinicConsultation from '@/stories/assets/clinic-consultation.jpg'
import postHeroExamRoom from '@/stories/assets/post-hero-exam-room.jpg'
import doctorPortrait from '@/stories/assets/doctor-portrait.jpg'

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
  title: 'Organisms/BlogCard',
  component: BlogCard.Simple,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BlogCard.Simple>

export default meta

type Story = StoryObj<typeof meta>

const mockPost: BlogCardBaseProps = {
  title: 'Die Zukunft der Telemedizin in Deutschland',
  excerpt:
    'Erfahren Sie, wie digitale Gesundheitslösungen die Patientenversorgung revolutionieren und welche Vorteile Telemedizin für Ärzte und Patienten bietet.',
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
    await expect(canvas.getByRole('link')).toBeInTheDocument()
    await expect(canvas.getByText('Die Zukunft der Telemedizin in Deutschland')).toBeInTheDocument()
    await expect(canvas.getByText('Gesundheitstechnologie')).toBeInTheDocument()
    await expect(canvas.getByAltText('Dr. Sarah Schmidt')).toBeInTheDocument()
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
      src: clinicConsultation.src,
      alt: 'Klinik Beratungsgespräch',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link')).toBeInTheDocument()
    await expect(canvas.getByText('Die Zukunft der Telemedizin in Deutschland')).toBeInTheDocument()
    await expect(canvas.getByText('15. Januar 2026')).toBeInTheDocument()
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
      src: postHeroExamRoom.src,
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
      src: clinicConsultation.src,
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
      src: postHeroExamRoom.src,
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
