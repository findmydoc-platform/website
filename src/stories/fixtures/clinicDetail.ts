import type { ClinicDetailData, ClinicDetailDoctor } from '@/components/templates/ClinicDetailConcepts'

import clinicConsultation from '../assets/clinic-consultation.jpg'
import clinicHospitalExterior from '../assets/clinic-hospital-exterior.jpg'
import clinicInterior from '../assets/content-clinic-interior.jpg'
import doctorPortrait from '../assets/doctor-portrait.jpg'
import examRoom from '../assets/post-hero-exam-room.jpg'
import ph570x544 from '../assets/placeholder-570-544.svg'
import ph570x256 from '../assets/placeholder-570-256.svg'

const toSrc = (image: string | { src: string }) => (typeof image === 'string' ? image : image.src)

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

const doctorImages = [toSrc(doctorPortrait), toSrc(clinicConsultation), toSrc(clinicInterior), toSrc(examRoom)]
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
  clinicSlug,
  clinicName: 'Berlin Health Clinic',
  heroImage: {
    src: toSrc(clinicHospitalExterior),
    alt: 'Berlin Health Clinic exterior',
  },
  description:
    'Berlin Health Clinic is a multidisciplinary pediatric center with a strong focus on transparent treatment information, verified quality standards, and family-centered care.',
  trust: {
    ratingValue: 4.8,
    reviewCount: 248,
    verification: 'gold',
    accreditations: ['ISO 9001', 'JCI', 'TUV Certified'],
    languages: ['English', 'German', 'Turkish', 'French'],
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
      title: 'Orthopedic recovery case',
      before: { src: toSrc(ph570x544), alt: 'Before orthopedic treatment' },
      after: { src: toSrc(clinicConsultation), alt: 'After orthopedic treatment' },
      description: 'A six-month progress story with physiotherapy and supervised strength training.',
      category: 'Orthopedic',
      durationLabel: '4 weeks',
    },
    {
      id: 'gallery-2',
      title: 'Respiratory therapy progression',
      before: { src: toSrc(ph570x256), alt: 'Before respiratory therapy' },
      after: { src: toSrc(clinicInterior), alt: 'After respiratory therapy' },
      description: 'Improvement in exercise tolerance through a personalized breathing rehabilitation program.',
      category: 'Respiratory',
      durationLabel: '8 weeks',
    },
    {
      id: 'gallery-3',
      title: 'Post-surgery mobility support',
      before: { src: toSrc(ph570x544), alt: 'Before mobility support program' },
      after: { src: toSrc(examRoom), alt: 'After mobility support program' },
      description: 'The plan combined surgery follow-up, pediatric rehab, and caregiver coaching.',
      category: 'Recovery',
      durationLabel: '12 weeks',
    },
    {
      id: 'gallery-4',
      title: 'Long-term chronic care outcome',
      before: { src: toSrc(ph570x256), alt: 'Before chronic care program' },
      after: { src: toSrc(doctorPortrait), alt: 'After chronic care program' },
      description: 'Quarterly monitoring and medication optimization with measurable quality-of-life gains.',
      category: 'Chronic Care',
      durationLabel: '16 weeks',
    },
    {
      id: 'gallery-5',
      title: 'Integrated nutrition and growth support',
      before: { src: toSrc(ph570x544), alt: 'Before nutrition and growth support' },
      after: { src: toSrc(clinicConsultation), alt: 'After nutrition and growth support' },
      description: 'A cross-functional care path involving pediatrics, nutrition, and counseling.',
      category: 'Nutrition',
      durationLabel: '24 weeks',
    },
    {
      id: 'gallery-6',
      title: 'Adolescent sports recovery',
      before: { src: toSrc(ph570x256), alt: 'Before sports recovery program' },
      after: { src: toSrc(clinicHospitalExterior), alt: 'After sports recovery program' },
      description: 'Functional recovery monitored with milestone-based rehab and regular specialist reviews.',
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
    ratingValue: undefined,
    reviewCount: undefined,
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
