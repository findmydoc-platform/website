import type { PlatformContentMedia, Category, Post } from '@/payload-types'
import type { BlogCardProps } from '@/components/organisms/Blog/BlogCard'

import clinicInterior from '@/stories/assets/content-clinic-interior.jpg'
import postHeroExamRoom from '@/stories/assets/post-hero-exam-room.jpg'
import clinicConsultation from '@/stories/assets/clinic-consultation.jpg'
import doctorPortrait from '@/stories/assets/doctor-portrait.jpg'

const getSrc = (img: any) => (typeof img === 'string' ? img : img?.src)

type RichTextPayload = NonNullable<Post['content']>

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
  url: getSrc(clinicInterior),
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
  url: getSrc(postHeroExamRoom),
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

export const sampleCardPost: BlogCardProps = {
  title: 'Comprehensive Dental Checkups',
  excerpt: 'Preventative care plans that keep smiles healthy year-round.',
  dateLabel: undefined,
  image: {
    src: samplePostMedia.url || '',
    alt: samplePostMedia.alt || '',
  },
}

const cosmeticDermatologyImage: BlogCardProps['image'] = {
  src: getSrc(clinicConsultation),
  alt: 'Dermatology consultation in a modern clinic',
}

const rehabProgramsImage: BlogCardProps['image'] = {
  src: getSrc(doctorPortrait),
  alt: 'Portrait of a rehabilitation specialist',
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

export const collectionPosts: BlogCardProps[] = [
  sampleCardPost,
  {
    ...sampleCardPost,
    title: 'Cosmetic Dermatology 101',
    excerpt: 'Personalized treatment paths for confident skin.',
    image: cosmeticDermatologyImage,
  },
  {
    ...sampleCardPost,
    title: 'Post-Injury Rehab Programs',
    excerpt: 'Recover mobility with multi-disciplinary care plans.',
    image: rehabProgramsImage,
  },
]
