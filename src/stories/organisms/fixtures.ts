import type { PlatformContentMedia, Category, Post, Page } from '@/payload-types'
import type { PostCardData } from '@/components/organisms/PostCard'

import clinicInterior from '@/stories/assets/content-clinic-interior.jpg'
import postHeroExamRoom from '@/stories/assets/post-hero-exam-room.jpg'
import clinicConsultation from '@/stories/assets/clinic-consultation.jpg'
import doctorPortrait from '@/stories/assets/doctor-portrait.jpg'

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
  alt: 'Bright clinic interior corridor',
  caption: sampleRichText,
  createdBy: 1,
  storagePath: 'src/stories/assets/content-clinic-interior.jpg',
  prefix: null,
  updatedAt: '2024-05-10T00:00:00.000Z',
  createdAt: '2024-05-10T00:00:00.000Z',
  deletedAt: null,
  url: clinicInterior.src,
  thumbnailURL: null,
  filename: 'content-clinic-interior.jpg',
  mimeType: 'image/jpeg',
  filesize: 210000,
  width: 1600,
  height: 1063,
  focalX: null,
  focalY: null,
  sizes: {},
}

export const samplePostMedia: PlatformContentMedia = {
  ...sampleMedia,
  id: 2,
  alt: 'Doctor consulting with a patient',
  storagePath: 'src/stories/assets/post-hero-exam-room.jpg',
  url: postHeroExamRoom.src,
  filename: 'post-hero-exam-room.jpg',
  mimeType: 'image/jpeg',
  filesize: 150000,
  width: 1600,
  height: 900,
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
    src: samplePostMedia.url || '',
    alt: samplePostMedia.alt || '',
    width: samplePostMedia.width || undefined,
    height: samplePostMedia.height || undefined,
  },
  categories: sampleCategories.map((c) => c.title),
}

const cosmeticDermatologyImage: PostCardData['image'] = {
  src: clinicConsultation.src,
  alt: 'Dermatology consultation in a modern clinic',
  width: 1600,
  height: 900,
}

const rehabProgramsImage: PostCardData['image'] = {
  src: doctorPortrait.src,
  alt: 'Portrait of a rehabilitation specialist',
  width: 1600,
  height: 900,
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
  heroImage: samplePostMedia,
  content: sampleRichText,
  excerpt: 'Regular screenings catch oral issues early and safeguard overall wellness.',
  relatedPosts: null,
  categories: sampleCategories,
  meta: {
    title: 'Preventative Dental Visits',
    image: samplePostMedia,
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
    image: cosmeticDermatologyImage,
  },
  {
    ...sampleCardPost,
    title: 'Post-Injury Rehab Programs',
    href: '/posts/post-injury-rehab',
    description: 'Recover mobility with multi-disciplinary care plans.',
    image: rehabProgramsImage,
  },
]
