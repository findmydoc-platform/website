import type { ClinicDetailData, ClinicDetailDoctor } from '@/components/templates/ClinicDetailConcepts'

import { getStoryImageSrc, storyClinicImages, storyPortraits } from './assets'

const clinicSlug = 'berlin-health-clinic'
const clinicContactHref = `/contact?clinic=${clinicSlug}&source=clinic-detail`

const doctorBlueprints = [
  { name: 'Dr. Amelia Carter', specialty: 'Pediatric Cardiology' },
  { name: 'Dr. Jonas Meyer', specialty: 'General Pediatrics' },
  { name: 'Dr. Sofia Legrand', specialty: 'Pediatric Neurology' },
  { name: 'Dr. Lukas Stein', specialty: 'Pediatric Endocrinology' },
  { name: 'Dr. Mila Novak', specialty: 'Developmental Pediatrics' },
  { name: 'Dr. Daniel Ruiz', specialty: 'Pediatric Pulmonology' },
  { name: 'Dr. Elif Aydin', specialty: 'Pediatric Immunology' },
  { name: 'Dr. Noah Fischer', specialty: 'Pediatric Gastroenterology' },
  { name: 'Dr. Hana Park', specialty: 'Neonatal Medicine' },
  { name: 'Dr. Samuel Hoffmann', specialty: 'Adolescent Medicine' },
  { name: 'Dr. Isabela Costa', specialty: 'Pediatric Rehabilitation' },
  { name: 'Dr. Leon Weber', specialty: 'Pediatric Infectious Diseases' },
]

const doctorImages = [
  getStoryImageSrc(storyPortraits.doctor),
  getStoryImageSrc(storyClinicImages.clinicDetail.consultation),
  getStoryImageSrc(storyClinicImages.clinicDetail.diagnostics),
  getStoryImageSrc(storyClinicImages.clinicDetail.treatmentRoom),
]
const doctorLanguages = [
  ['English', 'German'],
  ['English', 'Turkish'],
  ['English', 'French'],
  ['English', 'Spanish'],
]
const doctorQualifications = [
  ['MD', 'FAAP'],
  ['MD', 'PhD'],
  ['MD', 'MSc Pediatric Care'],
  ['MD', 'DCH'],
]

function buildDoctor(index: number): ClinicDetailDoctor {
  const blueprint = doctorBlueprints[index % doctorBlueprints.length]!
  const reviewCount = 60 + index * 3
  const ratingValue = Number((4.2 + (index % 7) * 0.1).toFixed(1))

  return {
    id: `doctor-${index + 1}`,
    name: blueprint.name,
    specialty: blueprint.specialty,
    ratingValue,
    reviewCount,
    qualifications: doctorQualifications[index % doctorQualifications.length],
    yearsExperience: 6 + (index % 15),
    languages: doctorLanguages[index % doctorLanguages.length],
    description:
      'Focused on evidence-based treatment plans, interdisciplinary care coordination, and transparent communication with families.',
    image: {
      src: doctorImages[index % doctorImages.length]!,
      alt: `${blueprint.name} portrait`,
    },
    contactHref: clinicContactHref,
    socialLinks:
      index % 3 === 0
        ? [{ kind: 'linkedin', href: '#', label: `${blueprint.name} on LinkedIn` }]
        : index % 5 === 0
          ? [
              { kind: 'meta', href: '#', label: `${blueprint.name} on Meta` },
              { kind: 'x', href: '#', label: `${blueprint.name} on X` },
            ]
          : undefined,
  }
}

const doctors = Array.from({ length: 13 }, (_, index) => buildDoctor(index))

export const clinicDetailFixture: ClinicDetailData = {
  clinicId: 1001,
  clinicSlug,
  clinicName: 'Berlin Health Clinic',
  heroImage: {
    src: getStoryImageSrc(storyClinicImages.clinicDetail.exterior),
    alt: 'Berlin Health Clinic exterior',
  },
  description:
    'Berlin Health Clinic is a multidisciplinary pediatric center with clinic-provided treatment information, service descriptions, and family-centered care details.',
  trust: {
    ratingValue: 4.8,
    reviewCount: 248,
    verification: 'gold',
    accreditations: ['Profile document A', 'Profile document B', 'Clinic document C'],
    languages: ['English', 'German', 'Turkish', 'French'],
  },
  reviews: {
    totalCount: 5,
    hasMore: false,
    items: [
      {
        id: 'review-1',
        reviewDate: '2026-01-12T09:15:00.000Z',
        ratingValue: 5,
        authorName: 'Maya K.',
        comment:
          'Demo review text describes appointment preparation, follow-up notes, and next-step communication for the review-card layout.',
      },
      {
        id: 'review-2',
        reviewDate: '2026-01-08T12:30:00.000Z',
        ratingValue: 5,
        authorName: 'Anna L.',
        comment: 'Demo feedback text covers reception flow, scheduling notes, and explanation copy in a review card.',
      },
      {
        id: 'review-3',
        reviewDate: '2026-01-05T10:00:00.000Z',
        ratingValue: 4,
        authorName: 'James D.',
        comment: 'Demo treatment-plan text covers timing, home-care checklist details, and line wrapping.',
      },
      {
        id: 'review-4',
        reviewDate: '2025-12-18T10:00:00.000Z',
        ratingValue: 5,
        authorName: 'Sofia L.',
        comment: 'Demo review entry with shorter copy for the expanded list state and spacing.',
      },
      {
        id: 'review-5',
        reviewDate: '2025-12-02T10:00:00.000Z',
        ratingValue: 4,
        comment: 'Demo anonymous review text about document preparation and follow-up instructions for the next visit.',
      },
    ],
  },
  treatments: [
    { id: 'treatment-1', name: 'Routine Checkup', category: 'Preventive Care', priceFromUsd: 120 },
    { id: 'treatment-2', name: 'Developmental Screening', category: 'Diagnostics', priceFromUsd: 180 },
    { id: 'treatment-3', name: 'Vaccination Package', category: 'Preventive Care', priceFromUsd: 230 },
    { id: 'treatment-4', name: 'Asthma Management Plan', category: 'Chronic Care', priceFromUsd: 310 },
    { id: 'treatment-5', name: 'Neurology Consultation', category: 'Specialist Care', priceFromUsd: 380 },
    { id: 'treatment-6', name: 'Pediatric Cardiology Review', category: 'Specialist Care', priceFromUsd: 460 },
    { id: 'treatment-7', name: 'Genetic Counseling', category: 'Specialist Care' },
    { id: 'treatment-8', name: 'Family Nutrition Coaching', category: 'Supportive Care', priceFromUsd: 150 },
  ],
  doctors,
  beforeAfterEntries: [
    {
      id: 'gallery-1',
      title: 'Orthopedic program timeline',
      before: { src: getStoryImageSrc(storyClinicImages.clinicDetail.exterior), alt: 'Before program placeholder' },
      after: {
        src: getStoryImageSrc(storyClinicImages.clinicDetail.rehabilitation),
        alt: 'After program placeholder',
      },
      description: 'Demo gallery item showing placeholder imagery for a four-week program timeline.',
      category: 'Orthopedic',
      durationLabel: '4 weeks',
    },
    {
      id: 'gallery-2',
      title: 'Respiratory program timeline',
      before: {
        src: getStoryImageSrc(storyClinicImages.clinicDetail.treatmentRoom),
        alt: 'Before program placeholder',
      },
      after: { src: getStoryImageSrc(storyClinicImages.clinicDetail.diagnostics), alt: 'After program placeholder' },
      description: 'Demo gallery item showing a second timeline card with treatment-room imagery.',
      category: 'Respiratory',
      durationLabel: '8 weeks',
    },
    {
      id: 'gallery-3',
      title: 'Mobility support timeline',
      before: {
        src: getStoryImageSrc(storyClinicImages.clinicDetail.rehabilitation),
        alt: 'Before program placeholder',
      },
      after: {
        src: getStoryImageSrc(storyClinicImages.clinicDetail.treatmentRoom),
        alt: 'After program placeholder',
      },
      description: 'Demo gallery item for a longer service sequence and category label.',
      category: 'Recovery',
      durationLabel: '12 weeks',
    },
    {
      id: 'gallery-4',
      title: 'Long-term care timeline',
      before: {
        src: getStoryImageSrc(storyClinicImages.clinicDetail.treatmentRoom),
        alt: 'Before program placeholder',
      },
      after: { src: getStoryImageSrc(storyPortraits.doctor), alt: 'After program placeholder' },
      description: 'Demo gallery item with portrait imagery and a sixteen-week duration label.',
      category: 'Chronic Care',
      durationLabel: '16 weeks',
    },
    {
      id: 'gallery-5',
      title: 'Nutrition support timeline',
      before: { src: getStoryImageSrc(storyClinicImages.clinicDetail.lab), alt: 'Before program placeholder' },
      after: {
        src: getStoryImageSrc(storyClinicImages.clinicDetail.consultation),
        alt: 'After program placeholder',
      },
      description: 'Demo gallery item for a multi-step service card with consultation imagery.',
      category: 'Nutrition',
      durationLabel: '24 weeks',
    },
    {
      id: 'gallery-6',
      title: 'Sports service timeline',
      before: {
        src: getStoryImageSrc(storyClinicImages.clinicDetail.treatmentRoom),
        alt: 'Before program placeholder',
      },
      after: {
        src: getStoryImageSrc(storyClinicImages.clinicDetail.rehabilitation),
        alt: 'After program placeholder',
      },
      description: 'Demo gallery item with a longer duration and rehabilitation imagery.',
      category: 'Sports',
      durationLabel: '32 weeks',
    },
  ],
  location: {
    fullAddress: 'Lichtenberger Strasse 24, 10179 Berlin, Germany',
    coordinates: { lat: 52.5168332, lng: 13.4264519 },
  },
  contactHref: clinicContactHref,
}

export const clinicDetailNoCoordinatesFixture: ClinicDetailData = {
  ...clinicDetailFixture,
  location: {
    fullAddress: clinicDetailFixture.location.fullAddress,
  },
}

export const clinicDetailNoLocationFixture: ClinicDetailData = {
  ...clinicDetailFixture,
  location: {},
}

export const clinicDetailNoReviewsFixture: ClinicDetailData = {
  ...clinicDetailFixture,
  trust: {
    ...clinicDetailFixture.trust,
    ratingValue: null,
    reviewCount: 0,
  },
  reviews: {
    totalCount: 0,
    items: [],
    hasMore: false,
  },
  doctors: clinicDetailFixture.doctors.map((doctor, index) =>
    index === 0
      ? {
          ...doctor,
          ratingValue: undefined,
          reviewCount: undefined,
        }
      : doctor,
  ),
}

export const clinicDetailReviewsPendingTextFixture: ClinicDetailData = {
  ...clinicDetailFixture,
  reviews: {
    totalCount: 2,
    items: [],
    hasMore: true,
  },
}

export const clinicDetailReviewsPartiallyLoadedFixture: ClinicDetailData = {
  ...clinicDetailFixture,
  reviews: {
    totalCount: 248,
    items: clinicDetailFixture.reviews.items.slice(0, 2),
    hasMore: true,
  },
}
