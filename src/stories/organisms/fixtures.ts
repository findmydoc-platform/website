import type { PlatformContentMedia, Category, Post, Page } from '@/payload-types'
import type { PostCardData } from '@/components/organisms/PostCard'

type RichTextPayload = NonNullable<Page['hero']['richText']>

export const sampleRichText: RichTextPayload = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'findmydoc connects patients with trusted clinics across specialties.',
            type: 'text',
            version: 1,
          },
        ],
      },
    ],
  },
} as RichTextPayload

export const sampleMedia: PlatformContentMedia = {
  id: 1,
  alt: 'Smiling patient at the clinic',
  caption: sampleRichText,
  createdBy: 1,
  storagePath: 'public/stories/hero.png',
  prefix: null,
  updatedAt: '2024-05-10T00:00:00.000Z',
  createdAt: '2024-05-10T00:00:00.000Z',
  deletedAt: null,
  url: '/fmd-logo-1-dark.png',
  thumbnailURL: null,
  filename: 'hero.png',
  mimeType: 'image/png',
  filesize: 120000,
  width: 1200,
  height: 768,
  focalX: null,
  focalY: null,
  sizes: {},
}

export const sampleCategories: Category[] = [
  {
    id: 1,
    title: 'Dental Care',
    generateSlug: null,
    slug: 'dental-care',
    parent: null,
    breadcrumbs: null,
    updatedAt: '2024-05-10T00:00:00.000Z',
    createdAt: '2024-05-10T00:00:00.000Z',
  },
  {
    id: 2,
    title: 'Cosmetic Medicine',
    generateSlug: null,
    slug: 'cosmetic-medicine',
    parent: null,
    breadcrumbs: null,
    updatedAt: '2024-05-10T00:00:00.000Z',
    createdAt: '2024-05-10T00:00:00.000Z',
  },
]

export const sampleCardPost: PostCardData = {
  title: 'Comprehensive Dental Checkups',
  href: '/posts/comprehensive-dental-checkups',
  description: 'Preventative care plans that keep smiles healthy year-round.',
  image: {
    src: sampleMedia.url || '',
    alt: sampleMedia.alt || '',
    width: sampleMedia.width || undefined,
    height: sampleMedia.height || undefined,
  },
  categories: sampleCategories.map((c) => c.title),
}

export const sampleHeroLinks: NonNullable<Page['hero']['links']> = [
  {
    link: {
      type: 'custom',
      url: '/contact',
      label: 'Book a consultation',
      appearance: 'default',
      newTab: false,
    },
  },
  {
    link: {
      type: 'custom',
      url: '/services',
      label: 'Browse treatments',
      appearance: 'outline',
      newTab: false,
    },
  },
]

export const sampleHighImpactHero: Page['hero'] = {
  type: 'highImpact',
  richText: sampleRichText,
  links: sampleHeroLinks,
  media: sampleMedia,
}

export const sampleMediumImpactHero: Page['hero'] = {
  type: 'mediumImpact',
  richText: sampleRichText,
  links: sampleHeroLinks,
  media: sampleMedia,
}

export const sampleLowImpactHero: Page['hero'] = {
  type: 'lowImpact',
  richText: sampleRichText,
}

export const samplePost: Post = {
  id: 1,
  title: 'How Preventative Dental Visits Boost Whole-Body Health',
  tags: null,
  heroImage: sampleMedia,
  content: sampleRichText,
  excerpt: 'Regular screenings catch oral issues early and safeguard overall wellness.',
  relatedPosts: null,
  categories: sampleCategories,
  meta: {
    title: 'Preventative Dental Visits',
    image: sampleMedia,
    description: 'Patient-first dental care built on proactive screenings.',
  },
  publishedAt: '2024-05-12T12:00:00.000Z',
  authors: null,
  populatedAuthors: [
    {
      id: 'author-1',
      name: 'Dr. Maya Patel',
    },
  ],
  generateSlug: null,
  slug: 'preventative-dental-visits',
  updatedAt: '2024-05-12T12:00:00.000Z',
  createdAt: '2024-05-01T08:00:00.000Z',
  deletedAt: null,
  _status: 'published',
}

export const collectionPosts: PostCardData[] = [
  sampleCardPost,
  {
    ...sampleCardPost,
    title: 'Cosmetic Dermatology 101',
    href: '/posts/cosmetic-dermatology-101',
    description: 'Personalized treatment paths for confident skin.',
  },
  {
    ...sampleCardPost,
    title: 'Post-Injury Rehab Programs',
    href: '/posts/post-injury-rehab',
    description: 'Recover mobility with multi-disciplinary care plans.',
  },
]
