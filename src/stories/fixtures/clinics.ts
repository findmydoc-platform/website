import { Award, BadgeCheck, Eye, Shield, Target, TrendingUp, Users } from 'lucide-react'

import type { ClinicResultCardData } from '@/components/organisms/ClinicResultCard'

import clinicConsultation from '@/stories/assets/clinic-consultation.jpg'
import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'
import clinicInterior from '@/stories/assets/content-clinic-interior.jpg'
import medicalHero from '@/stories/assets/medical-hero.jpg'

const mergeField = <T>(baseValue: T, override?: Partial<T>): T =>
  override ? ({ ...baseValue, ...override } as T) : baseValue

const mergeActions = (
  baseActions: ClinicResultCardData['actions'],
  override?: ClinicResultCardData['actions'],
): ClinicResultCardData['actions'] => {
  if (!override) return baseActions
  return {
    details: mergeField(baseActions.details, override.details),
    compare: mergeField(baseActions.compare, override.compare),
  }
}

export const clinicMedia = {
  hospitalExterior: { src: clinicHospitalExterior.src, alt: 'Modern clinic exterior' },
  consultation: { src: clinicConsultation.src, alt: 'Doctor consulting with a patient' },
  interior: { src: clinicInterior.src, alt: 'Bright clinic interior' },
  hero: { src: medicalHero.src, alt: 'Hospital corridor' },
}

const baseClinic: ClinicResultCardData = {
  rank: 1,
  name: 'Clinic Example',
  location: 'Berlin, Mitte',
  media: clinicMedia.hospitalExterior,
  verification: { variant: 'gold' },
  rating: { value: 4.5, count: 120 },
  waitTime: '2-3 weeks',
  tags: ['General surgery', 'Modern facilities'],
  priceFrom: { label: 'From', value: 7500, currency: 'EUR' },
  actions: {
    details: { href: '#', label: 'Details' },
    compare: { href: '#', label: 'Compare' },
  },
}

export const makeClinic = (overrides: Partial<ClinicResultCardData>): ClinicResultCardData => {
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
    { value: '500+', label: 'Verified clinics', Icon: Users },
    { value: '1,200+', label: 'Treatment types', Icon: BadgeCheck },
    { value: '98%', label: 'Satisfaction rate', Icon: Award },
    { value: 'TÜV', label: 'Verified platform', Icon: Shield },
  ],
  badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
}

export const clinicResults: ClinicResultCardData[] = [
  makeClinic({
    rank: 1,
    name: 'Ring Clinic',
    location: 'Cologne, City Center',
    media: { ...clinicMedia.hospitalExterior, priority: true },
    verification: { variant: 'unverified' },
    rating: { value: 4.4, count: 156 },
    waitTime: '4-5 weeks',
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
    waitTime: '3-4 weeks',
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
    waitTime: '3-4 weeks',
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
    waitTime: '2-3 weeks',
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
    waitTime: '1-2 weeks',
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
    waitTime: '2-3 weeks',
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
    waitTime: '3-4 weeks',
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
    waitTime: '2-3 weeks',
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
    waitTime: '4-6 weeks',
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
    waitTime: '1-3 weeks',
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
    waitTime: '2-3 weeks',
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
    waitTime: '1-2 weeks',
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
    waitTime: '1-2 weeks',
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
    waitTime: '2-3 weeks',
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
    waitTime: '3-5 weeks',
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
    waitTime: '1-2 weeks',
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
    waitTime: '2-3 weeks',
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
    waitTime: '4-6 weeks',
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
    waitTime: '2-3 weeks',
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
    waitTime: '1-2 weeks',
    tags: ['Dental implant', 'Hip replacement', 'Neighborhood care'],
    priceFrom: { label: 'From', value: 8700, currency: 'EUR' },
  }),
]

export const makeClinicList = (count: number, source: ClinicResultCardData[] = clinicResults) =>
  source.length === 0
    ? []
    : Array.from({ length: count }).map((_, idx) => {
        const base = source[idx % source.length] as ClinicResultCardData
        return makeClinic({
          ...base,
          rank: idx + 1,
          name: `${base.name} #${idx + 1}`,
        })
      })

export const sampleClinic: ClinicResultCardData = clinicResults[0] ?? makeClinic({})
export const sampleClinicRating = sampleClinic.rating
export const sampleClinicWaitTime = sampleClinic.waitTime
export const sampleClinicTags = sampleClinic.tags
export const sampleClinicLocation = sampleClinic.location

export const clinicHeroData = {
  title: 'Helping companies do good things',
  description:
    'Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos. Mazim nemore singulis an ius, nullam ornatus nam ei.',
  image: 'https://placehold.co/1440x768', // Placeholder for now
}

export const clinicFeaturesData = [
  {
    title: 'Qualified Leads',
    description: 'Quidam officiis similique sea ei, vel tollit indoctum efficiendi nihil tantas platonem eos.',
    icon: Target,
  },
  {
    title: 'Reputation Boost',
    description: 'Deseruisse definitionem his et, an has veri integre abhorreant, nam alii epicurei et.',
    icon: TrendingUp,
  },
  {
    title: 'Visibility Increase',
    description: 'Ea eos essent ornatus percipit, mea an persecuti pertinacia, te suas semper per.',
    icon: Eye,
  },
]

export const clinicProcessData = [
  {
    step: 1,
    title: 'Reach Out',
    description:
      'Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos. Mazim nemore singulis an ius, nullam ornatus nam ei.',
  },
  {
    step: 2,
    title: 'Create Your Profile',
    description:
      'Vix habeo scaevola percipitur ne, qui noster abhorreant ne, mea in dicant eligendi evertitur. Ad falli aliquid menandri his. Usu vocent copiosae ut. No nihil munere eum.',
  },
  {
    step: 3,
    title: 'Verification & Quality Check',
    description:
      'Te aliquam noluisse his. Et vel epicuri detracto indoctum, et fierent pericula vim, veniam epicuri an eum. Ad mutat quaestio erroribus eam, ei mea modus volumus abhorreant.',
  },
  {
    step: 4,
    title: 'Connect with Patients',
    description:
      'Te aliquam noluisse his. Et vel epicuri detracto indoctum, et fierent pericula vim, veniam epicuri an eum. Ad mutat quaestio erroribus eam, ei mea modus volumus abhorreant.',
  },
]

export const clinicCategoriesData = [
  { name: 'All', active: true },
  { name: 'Eyes', active: false },
  { name: 'Body', active: false },
  { name: 'Hair', active: false },
  { name: 'Dental', active: false },
  { name: 'Nose', active: false },
]

export const clinicCategoryImages = [
  { src: 'https://placehold.co/570x544', alt: 'Category 1', size: 'large' },
  { src: 'https://placehold.co/570x256', alt: 'Category 2', size: 'medium' },
  { src: 'https://placehold.co/270x256', alt: 'Category 3', size: 'small' },
  { src: 'https://placehold.co/270x256', alt: 'Category 4', size: 'small' },
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
    image: 'https://placehold.co/370x448',
    socials: { facebook: '#', twitter: '#', instagram: '#' },
  },
  {
    name: 'Volkan Kablan',
    role: 'Founder',
    image: 'https://placehold.co/370x448',
    socials: { facebook: '#', twitter: '#', instagram: '#' },
  },
  {
    name: 'Anil Öz',
    role: 'HR',
    image: 'https://placehold.co/370x448',
    socials: { facebook: '#', twitter: '#', instagram: '#' },
  },
]

export const clinicTestimonialsData = [
  {
    quote:
      'Quidam officiis similique indoctum platonem singulis ornatus nam maiestatis everti invenire intellegam, legendos consequuntur eu sit.',
    author: 'Shirline Dungey',
    role: 'Apple',
    image: 'https://placehold.co/80x80',
  },
  {
    quote:
      'Dicat eripuit accumsan facilisi has cetero argumentum, vel at fugit definitionem integre abhorreant epicurei ferri aperiri pri.',
    author: 'Hector Mariano',
    role: 'Google',
    image: 'https://placehold.co/80x80',
  },
  {
    quote:
      'His dolorem habemus mandamus et, eius ponderum lorem molestiae ne, esse vulputate definitiones iracundia bonorum graecis convenire assum novum eu.',
    author: 'Tiontay Carroll',
    role: 'Facebook',
    image: 'https://placehold.co/80x80',
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
    image: 'https://placehold.co/270x292',
  },
  {
    date: '20 august 2019',
    title: 'Future of customer support',
    excerpt:
      'Lorem ipsum dolor euismod invidunt pro, ne his dolorum molestie reprehendunt, quo luptatum evertitur integre suavitate per an, alienum phaedrum te sea.',
    image: 'https://placehold.co/270x292',
  },
  {
    date: '20 august 2019',
    title: 'Future of customer support',
    excerpt:
      'Lorem ipsum dolor euismod invidunt pro, ne his dolorum molestie reprehendunt, quo luptatum evertitur integre suavitate per an, alienum phaedrum te sea.',
    image: 'https://placehold.co/270x292',
  },
]
