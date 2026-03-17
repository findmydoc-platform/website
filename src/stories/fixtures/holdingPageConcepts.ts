import type { UiLinkProps } from '@/components/molecules/Link'
import type { HoldingPageConceptProps } from '@/components/templates/HoldingPageConcept'
import { ArrowLeftRight, ShieldCheck, UserRoundSearch } from 'lucide-react'

import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'
import medicalHero from '@/stories/assets/medical-hero.jpg'

const footerLinks: UiLinkProps[] = [
  { href: '#contact', label: 'Contact', appearance: 'inline' },
  { href: '/privacy-policy', label: 'Privacy Policy', appearance: 'inline' },
  { href: '/imprint', label: 'Imprint', appearance: 'inline' },
  {
    href: 'https://www.istockphoto.com/de/video/medizinisches-dokument-junge-%C3%A4rztin-erkl%C3%A4rt-dokument-mit-analysen-auf-dem-tisch-und-gm2175001398-594611883',
    label: 'Video Reference',
    appearance: 'inline',
    newTab: true,
  },
]

const internalLinks: UiLinkProps[] = [
  { href: '/listing-comparison', label: 'Compare clinics', appearance: 'inline' },
  { href: '/posts', label: 'Treatment guides', appearance: 'inline' },
  { href: '/partners/clinics', label: 'For clinics', appearance: 'inline' },
]

export const holdingPageConcept: HoldingPageConceptProps = {
  backgroundImage: medicalHero,
  backgroundImageClassName: 'object-center',
  bestFor:
    'A launch direction that feels cinematic and calm at once: the video creates immediate presence, then the page steps back and lets trust, clarity, and intent breathe.',
  contactDescription:
    'Use this contact form to send us a direct request. Include a short title, your message, and your email so we can reply.',
  contactMode: 'full',
  contactTitle: 'Contact us',
  description:
    'Findmydoc is launching a clearer way to compare clinics abroad. This immersive hero is built to showcase a premium background video with minimal distraction.',
  eyebrow: 'Trusted treatment decisions start with transparent comparison',
  footerLinks,
  heroVideo: {
    ctaHref: '#contact',
    crossfadeMs: 700,
    playbackRate: 0.88,
    posterSrc: clinicHospitalExterior,
    videoSrc: '/stories/immersive-hero-loop.mp4',
    requiredLabel: 'Background video currently unavailable',
    subheadlineText: 'Find verified clinics, compare quality signals, and decide with confidence.',
    useReducedMotionFallback: true,
    withCrossfade: true,
  },
  layoutMode: 'video',
  mediaNote: {
    badge: 'Immersive hero',
    description:
      'Use a high-resolution loop with calm medical or arrival motion. The composition is optimized for headline readability and wow impact.',
    title: 'Fullscreen motion should feel premium, bright, and trustworthy.',
  },
  narrative:
    'Findmydoc is designed for people who want to compare clinics abroad with more confidence before making a medical travel decision. Instead of switching between fragmented websites, patients can review structured clinic profiles, treatment options, and transparent quality signals in one comparison flow.\n\nThe goal is to make clinic research easier to understand, easier to verify, and easier to act on. By combining verification status, patient reviews, listed accreditations, and specialty fit, this layout supports clearer expectations and more informed next steps. The section also keeps legal transparency visible through direct links to Privacy Policy and Imprint, while still preserving a calm, focused reading experience below the hero.',
  overlayClassName: 'from-white/94 via-sky-50/68 to-white/88',
  primaryCtaLabel: 'Send message',
  searchSnapshot: {
    internalLinks,
    metaDescription:
      'Findmydoc helps you compare clinics abroad with trusted information, clearer choices, and a confident next step before treatment.',
    metaTitle: 'Findmydoc Launch | Compare Clinics Abroad',
    primaryKeyword: 'compare clinics abroad',
    searchIntent: 'Comparative with launch-intent trust',
  },
  signals: [
    {
      title: 'Compare verified clinics',
      body: 'Review treatment options, specialties, and transparent profile data side by side before making contact.',
      icon: UserRoundSearch,
    },
    {
      title: 'Trust through quality signals',
      body: 'Use ratings, patient reviews, verification status, and listed accreditations to evaluate clinics with more confidence.',
      icon: ShieldCheck,
    },
    {
      title: 'Direct contact without intermediaries',
      body: 'Patients can contact clinics directly, while clinics present services and qualifications in one comparable format.',
      icon: ArrowLeftRight,
    },
  ],
  specialties: ['Dental', 'Eye Care', 'Hair Restoration', 'Plastic Surgery'],
  statusLabel: 'Coming Soon',
  supportingNote:
    'Reference mood: a luminous, premium motion canvas with quiet confidence, minimal words, and the feeling that something meaningful is about to begin.',
  themeName: 'Immersive fullscreen hero',
  title: 'A new way to compare clinics abroad starts here.',
  visualVariant: 'videoImmersiveHero',
}
