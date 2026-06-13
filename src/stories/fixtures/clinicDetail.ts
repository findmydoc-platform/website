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

  return {
    id: `doctor-${index + 1}`,
    name: blueprint.name,
    specialty: blueprint.specialty,
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
    ratingValue: null,
    reviewCount: 0,
    verification: 'unverified',
    accreditations: [],
    languages: ['English', 'German', 'Turkish', 'French'],
  },
  reviews: {
    totalCount: 0,
    hasMore: false,
    items: [],
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
  beforeAfterEntries: [],
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
    totalCount: 0,
    items: [],
    hasMore: false,
  },
}

export const clinicDetailReviewsPartiallyLoadedFixture: ClinicDetailData = {
  ...clinicDetailFixture,
  reviews: {
    totalCount: 0,
    items: [],
    hasMore: false,
  },
}
