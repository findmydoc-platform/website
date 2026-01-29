import { Award, BadgeCheck, Eye, Shield, Target, TrendingUp, Users } from 'lucide-react'

import type { ListingCardData } from '@/components/organisms/Listing'

import clinicConsultation from '@/stories/assets/clinic-consultation.jpg'
import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'
import clinicInterior from '@/stories/assets/content-clinic-interior.jpg'
import ph570x544 from '@/stories/assets/placeholder-570-544.svg'
import ph570x256 from '@/stories/assets/placeholder-570-256.svg'
import ph270x256 from '@/stories/assets/placeholder-270-256.svg'
import ph370x448 from '@/stories/assets/placeholder-370-448.svg'
import ph80x80 from '@/stories/assets/placeholder-80-80.svg'
import ph270x292 from '@/stories/assets/placeholder-270-292.svg'

const mergeField = <T>(baseValue: T, override?: Partial<T>): T =>
  override ? ({ ...baseValue, ...override } as T) : baseValue

const mergeActions = (
  baseActions: ListingCardData['actions'],
  override?: ListingCardData['actions'],
): ListingCardData['actions'] => {
  if (!override) return baseActions
  return {
    details: mergeField(baseActions.details, override.details),
    compare: mergeField(baseActions.compare, override.compare),
  }
}

const getSrc = (img: string | { src: string }) => (typeof img === 'string' ? img : img?.src)

export const clinicMedia = {
  hospitalExterior: { src: getSrc(clinicHospitalExterior), alt: 'Modern clinic exterior' },
  consultation: { src: getSrc(clinicConsultation), alt: 'Doctor consulting with a patient' },
  interior: { src: getSrc(clinicInterior), alt: 'Bright clinic interior' },
  hero: { src: getSrc(clinicHospitalExterior), alt: 'Modern clinic exterior' },
}

const baseClinic: ListingCardData = {
  rank: 1,
  name: 'Clinic Example',
  location: 'Berlin, Mitte',
  media: clinicMedia.hospitalExterior,
  verification: { variant: 'gold' },
  rating: { value: 4.5, count: 120 },
  waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
  tags: ['General surgery', 'Modern facilities'],
  priceFrom: { label: 'From', value: 7500, currency: 'EUR' },
  actions: {
    details: { href: '#', label: 'Details' },
    compare: { href: '#', label: 'Compare' },
  },
}

export const makeClinic = (overrides: Partial<ListingCardData>): ListingCardData => {
  const merged = {
    ...baseClinic,
    ...overrides,
  }

  return {
    ...merged,
    media: mergeField(baseClinic.media, overrides.media),
    rating: mergeField(baseClinic.rating, overrides.rating),
    priceFrom: mergeField(baseClinic.priceFrom, overrides.priceFrom),
    actions: mergeActions(baseClinic.actions, overrides.actions),
    verification: overrides.verification ?? baseClinic.verification,
  }
}

export const clinicFilterOptions = {
  cities: ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund'],
  waitTimes: [
    { label: 'Up to 1 week', minWeeks: 0, maxWeeks: 1 },
    { label: 'Up to 2 weeks', minWeeks: 0, maxWeeks: 2 },
    { label: 'Up to 4 weeks', minWeeks: 0, maxWeeks: 4 },
    { label: 'Over 4 weeks', minWeeks: 4, maxWeeks: undefined },
  ],
  treatments: ['Hip replacement', 'Knee replacement', 'Cataract surgery', 'Dental implant', 'LASIK eye surgery'],
}

export const clinicTrust = {
  title: 'Trust proven quality',
  subtitle: 'We only work with certified clinics and guarantee transparent, up-to-date pricing information',
  stats: [
    { value: 500, suffix: '+', label: 'Verified clinics', Icon: Users },
    { value: 1200, suffix: '+', label: 'Treatment types', Icon: BadgeCheck },
    { value: 98, suffix: '%', label: 'Satisfaction rate', Icon: Award },
    { valueText: 'TÜV', label: 'Verified platform', Icon: Shield },
  ],
  badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
}

export const clinicResults: ListingCardData[] = [
  makeClinic({
    rank: 1,
    name: 'Ring Clinic',
    location: 'Cologne, City Center',
    media: { ...clinicMedia.hospitalExterior, priority: true },
    verification: { variant: 'unverified' },
    rating: { value: 4.4, count: 156 },
    waitTime: { label: '4-5 weeks', minWeeks: 4, maxWeeks: 5 },
    tags: ['Affordable pricing', 'Great facilities', 'Central location'],
    priceFrom: { label: 'From', value: 7200, currency: 'EUR' },
  }),
  makeClinic({
    rank: 2,
    name: 'Munich Medical Center',
    location: 'Munich, Schwabing',
    media: clinicMedia.hero,
    verification: { variant: 'gold' },
    rating: { value: 4.6, count: 189 },
    waitTime: { label: '3-4 weeks', minWeeks: 3, maxWeeks: 4 },
    tags: ['Specialized orthopedics', 'Short waits', 'On-site physiotherapy'],
    priceFrom: { label: 'From', value: 7800, currency: 'EUR' },
  }),
  makeClinic({
    rank: 3,
    name: 'Stuttgart Surgical Clinic',
    location: 'Stuttgart, Bad Cannstatt',
    media: clinicMedia.interior,
    verification: { variant: 'gold' },
    rating: { value: 4.5, count: 178 },
    waitTime: { label: '3-4 weeks', minWeeks: 3, maxWeeks: 4 },
    tags: ['Experienced team', 'Modern rehab', 'Personalized care'],
    priceFrom: { label: 'From', value: 8100, currency: 'EUR' },
  }),
  makeClinic({
    rank: 4,
    name: 'Berlin University Hospital',
    location: 'Berlin, Mitte',
    media: clinicMedia.consultation,
    verification: { variant: 'gold' },
    rating: { value: 4.8, count: 245 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Modern operating rooms', 'Specialist physicians', 'Aftercare included'],
    priceFrom: { label: 'From', value: 8500, currency: 'EUR' },
  }),
  makeClinic({
    rank: 5,
    name: 'Hamburg Coastal Clinic',
    location: 'Hamburg, Altona',
    media: clinicMedia.interior,
    verification: { variant: 'silver' },
    rating: { value: 3.1, count: 132 },
    waitTime: { label: '1-2 weeks', minWeeks: 1, maxWeeks: 2 },
    tags: ['Hip replacement', 'Harbor views', 'Rehab suites'],
    priceFrom: { label: 'From', value: 2500, currency: 'EUR' },
  }),
  makeClinic({
    rank: 6,
    name: 'Frankfurt Heart Institute',
    location: 'Frankfurt, Westend',
    media: clinicMedia.hero,
    verification: { variant: 'gold' },
    rating: { value: 4.9, count: 312 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Cardiology', 'Cath lab', 'Intensive aftercare'],
    priceFrom: { label: 'From', value: 15000, currency: 'EUR' },
  }),
  makeClinic({
    rank: 7,
    name: 'Stuttgart Spine Center',
    location: 'Stuttgart, Vaihingen',
    media: clinicMedia.hospitalExterior,
    verification: { variant: 'bronze' },
    rating: { value: 2.8, count: 98 },
    waitTime: { label: '3-4 weeks', minWeeks: 3, maxWeeks: 4 },
    tags: ['Spine surgery', 'Robotic assistance', 'Rehabilitation'],
    priceFrom: { label: 'From', value: 4300, currency: 'EUR' },
  }),
  makeClinic({
    rank: 8,
    name: 'Munich Orthopedic Group',
    location: 'Munich, Bogenhausen',
    media: clinicMedia.consultation,
    verification: { variant: 'silver' },
    rating: { value: 4.7, count: 204 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Knee replacement', 'Sports rehab', 'Private rooms'],
    priceFrom: { label: 'From', value: 9100, currency: 'EUR' },
  }),
  makeClinic({
    rank: 9,
    name: 'Dortmund Care Hospital',
    location: 'Dortmund, Innenstadt-West',
    media: clinicMedia.interior,
    verification: { variant: 'unverified' },
    rating: { value: 2.2, count: 121 },
    waitTime: { label: '4-6 weeks', minWeeks: 4, maxWeeks: 6 },
    tags: ['General surgery', 'Hip replacement', 'Family suites'],
    priceFrom: { label: 'From', value: 1200, currency: 'EUR' },
  }),
  makeClinic({
    rank: 10,
    name: 'Düsseldorf Surgical Pavilion',
    location: 'Düsseldorf, Oberkassel',
    media: clinicMedia.hospitalExterior,
    verification: { variant: 'gold' },
    rating: { value: 4.5, count: 174 },
    waitTime: { label: '1-3 weeks', minWeeks: 1, maxWeeks: 3 },
    tags: ['Minimally invasive', 'Cataract surgery', 'Recovery lounges'],
    priceFrom: { label: 'From', value: 19500, currency: 'EUR' },
  }),
  makeClinic({
    rank: 11,
    name: 'Cologne Riverfront Clinic',
    location: 'Cologne, Deutz',
    media: clinicMedia.consultation,
    verification: { variant: 'silver' },
    rating: { value: 3.7, count: 143 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Dental implant', 'Scenic setting', 'Patient concierge'],
    priceFrom: { label: 'From', value: 5700, currency: 'EUR' },
  }),
  makeClinic({
    rank: 12,
    name: 'Berlin Eastside Medical',
    location: 'Berlin, Friedrichshain',
    media: clinicMedia.hero,
    verification: { variant: 'bronze' },
    rating: { value: 3.9, count: 167 },
    waitTime: { label: '1-2 weeks', minWeeks: 1, maxWeeks: 2 },
    tags: ['LASIK eye surgery', 'Digital records', 'Evening clinics'],
    priceFrom: { label: 'From', value: 6600, currency: 'EUR' },
  }),
  makeClinic({
    rank: 13,
    name: 'Hamburg Vision Center',
    location: 'Hamburg, HafenCity',
    media: clinicMedia.interior,
    verification: { variant: 'gold' },
    rating: { value: 4.7, count: 201 },
    waitTime: { label: '1-2 weeks', minWeeks: 1, maxWeeks: 2 },
    tags: ['LASIK eye surgery', 'Cataract surgery', 'Harbor shuttle'],
    priceFrom: { label: 'From', value: 8300, currency: 'EUR' },
  }),
  makeClinic({
    rank: 14,
    name: 'Frankfurt Joint Clinic',
    location: 'Frankfurt, Sachsenhausen',
    media: clinicMedia.hospitalExterior,
    verification: { variant: 'silver' },
    rating: { value: 4.4, count: 154 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Knee replacement', 'Hip replacement', 'On-site rehab gym'],
    priceFrom: { label: 'From', value: 10200, currency: 'EUR' },
  }),
  makeClinic({
    rank: 15,
    name: 'Stuttgart Rehabilitation Hospital',
    location: 'Stuttgart, Möhringen',
    media: clinicMedia.consultation,
    verification: { variant: 'unverified' },
    rating: { value: 1.9, count: 109 },
    waitTime: { label: '3-5 weeks', minWeeks: 3, maxWeeks: 5 },
    tags: ['Rehabilitation', 'Hydrotherapy', 'Family programs'],
    priceFrom: { label: 'From', value: 3200, currency: 'EUR' },
  }),
  makeClinic({
    rank: 16,
    name: 'Munich Cardio Clinic',
    location: 'Munich, Sendling',
    media: clinicMedia.hero,
    verification: { variant: 'gold' },
    rating: { value: 5.0, count: 402 },
    waitTime: { label: '1-2 weeks', minWeeks: 1, maxWeeks: 2 },
    tags: ['Cardiology', 'Hybrid OR', 'Aftercare coaching'],
    priceFrom: { label: 'From', value: 17600, currency: 'EUR' },
  }),
  makeClinic({
    rank: 17,
    name: 'Dortmund Sports Medicine Center',
    location: 'Dortmund, Hörde',
    media: clinicMedia.interior,
    verification: { variant: 'bronze' },
    rating: { value: 4.3, count: 141 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Sports medicine', 'ACL repair', 'Strength lab'],
    priceFrom: { label: 'From', value: 7500, currency: 'EUR' },
  }),
  makeClinic({
    rank: 18,
    name: 'Düsseldorf Oncology Institute',
    location: 'Düsseldorf, Derendorf',
    media: clinicMedia.hospitalExterior,
    verification: { variant: 'gold' },
    rating: { value: 4.1, count: 198 },
    waitTime: { label: '4-6 weeks', minWeeks: 4, maxWeeks: 6 },
    tags: ['Oncology', 'Radiation therapy', 'Support programs'],
    priceFrom: { label: 'From', value: 18200, currency: 'EUR' },
  }),
  makeClinic({
    rank: 19,
    name: 'Cologne Pediatric Hospital',
    location: 'Cologne, Ehrenfeld',
    media: clinicMedia.consultation,
    verification: { variant: 'silver' },
    rating: { value: 2.5, count: 173 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Pediatrics', 'Family housing', 'Child life services'],
    priceFrom: { label: 'From', value: 1400, currency: 'EUR' },
  }),
  makeClinic({
    rank: 20,
    name: 'Berlin Prenzlauer Clinic',
    location: 'Berlin, Prenzlauer Berg',
    media: clinicMedia.interior,
    verification: { variant: 'gold' },
    rating: { value: 4.7, count: 222 },
    waitTime: { label: '1-2 weeks', minWeeks: 1, maxWeeks: 2 },
    tags: ['Dental implant', 'Hip replacement', 'Neighborhood care'],
    priceFrom: { label: 'From', value: 8700, currency: 'EUR' },
  }),
]

export const makeClinicList = (count: number, source: ListingCardData[] = clinicResults) =>
  source.length === 0
    ? []
    : Array.from({ length: count }).map((_, idx) => {
        const base = source[idx % source.length] as ListingCardData
        return makeClinic({
          ...base,
          rank: idx + 1,
          name: `${base.name} #${idx + 1}`,
        })
      })

export const sampleClinic: ListingCardData = clinicResults[0] ?? makeClinic({})
export const sampleClinicRating = sampleClinic.rating
export const sampleClinicWaitTime = sampleClinic.waitTime
export const sampleClinicTags = sampleClinic.tags
export const sampleClinicLocation = sampleClinic.location

export const clinicHeroData = {
  title: 'Gain International Patients Through a Trusted Global Clinic Platform',
  description:
    'Increase your clinic’s international reach and connect with qualified patients worldwide. Our comparison platform helps clinics, medical networks, and international patient departments gain visibility, trust, and high-intent inquiries - globally and sustainably.',
  image: getSrc(clinicHospitalExterior),
}

export const clinicFeaturesData = [
  {
    title: 'Qualified Leads',
    subtitle: 'Easy & Robust',
    description:
      'Receive patient inquiries from users actively comparing clinics and treatments. Only relevant and treatment focused leads.',
    icon: Target,
  },
  {
    title: 'Reputation Boost',
    subtitle: 'Huge Collection',
    description:
      'Strengthen your clinic’s credibility through verified qualifications and transparent profiles that build trust with international patients.',
    icon: TrendingUp,
  },
  {
    title: 'Visibility Increase',
    subtitle: 'Responsive & Retina',
    description:
      'Increase your clinic’s visibility where international patients search, compare and decide across the DACH region.',
    icon: Eye,
  },
]

export const clinicProcessData = [
  {
    step: 1,
    title: 'Reach Out',
    description:
      'You contact us and receive a clear overview of how the platform works, including visibility options, regions, and patient demand.',
  },
  {
    step: 2,
    title: 'Finalize Profile',
    description:
      'Clinics create and manage their own profiles. This ensures full control over medical information, treatments offered, languages, expertise, and international patient services presented clearly for patient comparison.',
  },
  {
    step: 3,
    title: 'Verification & Quality Check',
    description:
      'Clinics are required to provide relevant qualifications and certifications according to their medical services. This verification process ensures credibility, transparency, and a high-quality environment for international patients.',
  },
  {
    step: 4,
    title: 'Connect with Patients',
    description:
      'Qualified international patients contact your clinic directly through the platform, ready to discuss treatments, and next steps.',
  },
]

export const homepageFaqSection = {
  title: 'FAQ',
  description:
    'This section answers the most common questions clinics and medical networks have about gaining international patients through our comparison platform.',
  defaultOpenItemId: 'q1',
  items: [
    {
      id: 'q1',
      question: 'How does this platform help clinics gain international patients?',
      answer:
        'By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.',
    },
    {
      id: 'q2',
      question: 'Are the patient inquiries exclusive?',
      answer: 'Inquiries are handled according to your clinic profile settings and availability.',
    },
    {
      id: 'q3',
      question: 'Which countries and regions are covered?',
      answer: 'Coverage depends on active campaigns and regional demand at the time of listing.',
    },
    {
      id: 'q4',
      question: 'Is this platform suitable for clinic groups and networks?',
      answer: 'Yes. Groups can maintain consistent branding while showcasing individual locations.',
    },
    {
      id: 'q5',
      question: 'Are patient inquiries focused on Europe?',
      answer: 'Demand is strongest across Europe, but can include other regions depending on campaigns.',
    },
  ],
}

export const clinicPartnersFaqSection = {
  title: 'FAQ',
  description:
    'This section answers the most common questions clinics and medical networks have about gaining international patients through our comparison platform.',
  defaultOpenItemId: 'q1',
  items: [
    {
      id: 'q1',
      question: 'How does this platform help clinics gain international patients?',
      answer:
        'By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.',
    },
    {
      id: 'q2',
      question: 'Are the patient inquiries exclusive?',
      answer: 'Patients contact clinics directly. There are no resold or recycled leads.',
    },
    {
      id: 'q3',
      question: 'Which countries and regions are covered?',
      answer:
        'Our primary focus is the DACH region (Germany, Austria, Switzerland), while also supporting international patient acquisition across Europe.',
    },
    {
      id: 'q4',
      question: 'Is this platform suitable for clinic groups and networks?',
      answer: 'Yes. We support single clinics, clinic groups, and medical networks with scalable visibility options.',
    },
    {
      id: 'q5',
      question: 'Are patient inquiries focused on Europe?',
      answer:
        'Most inquiries originate from patients seeking treatment within Europe, with a strong focus on the DACH region.',
    },
  ],
}

export const clinicCategoriesData = [
  { label: 'All', value: 'all' },
  { label: 'Eyes', value: 'eyes' },
  { label: 'Body', value: 'body' },
  { label: 'Hair', value: 'hair' },
  { label: 'Dental', value: 'dental' },
  { label: 'Nose', value: 'nose' },
]

export const clinicCategoryFeaturedIds = ['rhinoplasty', 'blepharoplasty', 'liposuction', 'veneers']

const makeCategoryHref = (treatmentId: string) => `/listing-comparison?treatment=${encodeURIComponent(treatmentId)}`

export const clinicCategoryItems = [
  {
    id: 'blepharoplasty',
    title: 'Blepharoplasty',
    subtitle: 'Eyelid rejuvenation',
    categories: ['eyes'],
    href: makeCategoryHref('blepharoplasty'),
    image: { src: getSrc(ph570x544), alt: 'Eye treatment example' },
  },
  {
    id: 'lasik',
    title: 'Laser Vision',
    subtitle: 'Corrective surgery',
    categories: ['eyes'],
    href: makeCategoryHref('lasik'),
    image: { src: getSrc(ph570x256), alt: 'Laser eye care example' },
  },
  {
    id: 'cat-eye-lift',
    title: 'Cat Eye Lift',
    subtitle: 'Canthoplasty',
    categories: ['eyes'],
    href: makeCategoryHref('cat-eye-lift'),
    image: { src: getSrc(ph270x256), alt: 'Cat eye lift example' },
  },
  {
    id: 'tear-trough',
    title: 'Tear Trough',
    subtitle: 'Dermal fillers',
    categories: ['eyes'],
    href: makeCategoryHref('tear-trough'),
    image: { src: getSrc(ph270x292), alt: 'Tear trough example' },
  },
  {
    id: 'liposuction',
    title: 'Liposuction',
    subtitle: 'Body contouring',
    categories: ['body'],
    href: makeCategoryHref('liposuction'),
    image: { src: getSrc(ph270x256), alt: 'Body contouring example' },
  },
  {
    id: 'body-lift',
    title: 'Body Lift',
    subtitle: 'Skin tightening',
    categories: ['body'],
    href: makeCategoryHref('body-lift'),
    image: { src: getSrc(ph270x292), alt: 'Body lift example' },
  },
  {
    id: 'tummy-tuck',
    title: 'Abdominoplasty',
    subtitle: 'Tummy tuck',
    categories: ['body'],
    href: makeCategoryHref('tummy-tuck'),
    image: { src: getSrc(ph570x544), alt: 'Abdominoplasty example' },
  },
  {
    id: 'cryo',
    title: 'Cryolipolysis',
    subtitle: 'Fat freezing',
    categories: ['body'],
    href: makeCategoryHref('cryo'),
    image: { src: getSrc(ph570x256), alt: 'Cryolipolysis example' },
  },
  {
    id: 'fue',
    title: 'FUE Transplant',
    subtitle: 'Hair restoration',
    categories: ['hair'],
    href: makeCategoryHref('fue'),
    image: { src: getSrc(ph370x448), alt: 'Hair restoration example' },
  },
  {
    id: 'prp',
    title: 'PRP Therapy',
    subtitle: 'Growth stimulation',
    categories: ['hair'],
    href: makeCategoryHref('prp'),
    image: { src: getSrc(ph270x292), alt: 'PRP treatment example' },
  },
  {
    id: 'laser-hair',
    title: 'Laser Removal',
    subtitle: 'Permanent reduction',
    categories: ['hair'],
    href: makeCategoryHref('laser-hair'),
    image: { src: getSrc(ph270x256), alt: 'Laser hair removal example' },
  },
  {
    id: 'scalp-micro',
    title: 'Scalp Micro',
    subtitle: 'Pigmentation',
    categories: ['hair'],
    href: makeCategoryHref('scalp-micro'),
    image: { src: getSrc(ph570x256), alt: 'Scalp micro pigmentation example' },
  },
  {
    id: 'veneers',
    title: 'Porcelain Veneers',
    subtitle: 'Smile makeover',
    categories: ['dental'],
    href: makeCategoryHref('veneers'),
    image: { src: getSrc(ph270x256), alt: 'Dental veneers example' },
  },
  {
    id: 'implants',
    title: 'Dental Implants',
    subtitle: 'Restoration',
    categories: ['dental'],
    href: makeCategoryHref('implants'),
    image: { src: getSrc(ph570x256), alt: 'Dental implant example' },
  },
  {
    id: 'whitening',
    title: 'Laser Whitening',
    subtitle: 'Brightening',
    categories: ['dental'],
    href: makeCategoryHref('whitening'),
    image: { src: getSrc(ph270x292), alt: 'Laser whitening example' },
  },
  {
    id: 'aligners',
    title: 'Clear Aligners',
    subtitle: 'Orthodontics',
    categories: ['dental'],
    href: makeCategoryHref('aligners'),
    image: { src: getSrc(ph570x544), alt: 'Clear aligners example' },
  },
  {
    id: 'rhinoplasty',
    title: 'Rhinoplasty',
    subtitle: 'Nose reshaping',
    categories: ['nose'],
    href: makeCategoryHref('rhinoplasty'),
    image: { src: getSrc(ph570x544), alt: 'Nose reshaping example' },
  },
  {
    id: 'septoplasty',
    title: 'Septoplasty',
    subtitle: 'Functional correction',
    categories: ['nose'],
    href: makeCategoryHref('septoplasty'),
    image: { src: getSrc(ph270x292), alt: 'Functional nose care example' },
  },
  {
    id: 'liquid-rhino',
    title: 'Liquid Rhino',
    subtitle: 'Non-surgical',
    categories: ['nose'],
    href: makeCategoryHref('liquid-rhino'),
    image: { src: getSrc(ph270x256), alt: 'Liquid rhinoplasty example' },
  },
  {
    id: 'revision-rhino',
    title: 'Revision',
    subtitle: 'Corrective surgery',
    categories: ['nose'],
    href: makeCategoryHref('revision-rhino'),
    image: { src: getSrc(ph570x256), alt: 'Revision rhinoplasty example' },
  },
]

export const clinicCTAData = {
  title: 'Let’s work together',
  buttonText: 'Contact us',
  buttonLink: '/contact',
}

export const clinicTeamData = [
  {
    name: 'Sebastian Schütze',
    role: 'CTO',
    image: getSrc(ph370x448),
    socials: { facebook: '#', twitter: '#', instagram: '#', linkedin: '#', github: '#' },
  },
  {
    name: 'Volkan Kablan',
    role: 'CFO',
    image: getSrc(ph370x448),
    socials: { facebook: '#', twitter: '#', instagram: '#', linkedin: '#', github: '#' },
  },
  {
    name: 'Anil Gökduman',
    role: 'CPO',
    image: getSrc(ph370x448),
    socials: { facebook: '#', twitter: '#', instagram: '#', linkedin: '#', github: '#' },
  },
  {
    name: 'Özen Günes',
    role: 'CLO',
    image: getSrc(ph370x448),
    socials: { facebook: '#', twitter: '#', instagram: '#', linkedin: '#', github: '#' },
  },
  {
    name: 'Youssef Adlah',
    role: 'CMO',
    image: getSrc(ph370x448),
    socials: { facebook: '#', twitter: '#', instagram: '#', linkedin: '#', github: '#' },
  },
]

export const clinicTestimonialsData = [
  {
    quote:
      'Quidam officiis similique indoctum platonem singulis ornatus nam maiestatis everti invenire intellegam, legendos consequuntur eu sit.',
    author: 'Shirline Dungey',
    role: 'Apple',
    image: getSrc(ph80x80),
  },
  {
    quote:
      'Dicat eripuit accumsan facilisi has cetero argumentum, vel at fugit definitionem integre abhorreant epicurei ferri aperiri pri.',
    author: 'Hector Mariano',
    role: 'Google',
    image: getSrc(ph80x80),
  },
  {
    quote:
      'His dolorem habemus mandamus et, eius ponderum lorem molestiae ne, esse vulputate definitiones iracundia bonorum graecis convenire assum novum eu.',
    author: 'Tiontay Carroll',
    role: 'Facebook',
    image: getSrc(ph80x80),
  },
]

export const clinicPricingData = [
  {
    price: '$9',
    plan: 'Abo',
    description:
      'Nam natum volutpat elitr vel qui purto dicit, bonorum minimum tation homero, at per assum dicit verterem.',
    buttonText: 'Apply now',
  },
  {
    price: 'individuell',
    plan: 'Provision',
    description:
      'Lorem deterruisset ea vis, usu eu hinc lorem inciderint, et mel solum autem molestiae mazim feugait electram an.',
    buttonText: 'make an appoitment',
  },
]

export const clinicBlogData = [
  {
    date: '20 august 2019',
    title: 'Future of customer support',
    excerpt:
      'Lorem ipsum dolor euismod invidunt pro, ne his dolorum molestie reprehendunt, quo luptatum evertitur integre suavitate per an, alienum phaedrum te sea.',
    image: getSrc(ph270x292),
  },
  {
    date: '20 august 2019',
    title: 'Future of customer support',
    excerpt:
      'Lorem ipsum dolor euismod invidunt pro, ne his dolorum molestie reprehendunt, quo luptatum evertitur integre suavitate per an, alienum phaedrum te sea.',
    image: getSrc(ph270x292),
  },
  {
    date: '20 august 2019',
    title: 'Future of customer support',
    excerpt:
      'Lorem ipsum dolor euismod invidunt pro, ne his dolorum molestie reprehendunt, quo luptatum evertitur integre suavitate per an, alienum phaedrum te sea.',
    image: getSrc(ph270x292),
  },
]
