import type { UiLinkProps } from '@/components/molecules/Link'
import type { HoldingPageConceptProps } from '@/components/templates/HoldingPageConcept'
import { ArrowLeftRight, ShieldCheck, UserRoundSearch } from 'lucide-react'

import { storyClinicImages } from './assets'

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
  backgroundImage: storyClinicImages.landing.hero,
  backgroundImageClassName: 'object-center',
  bestFor:
    'A launch direction that feels cinematic and calm at once: the video creates immediate presence, then the page steps back and lets trust, clarity, and intent breathe.',
  contactFormSlug: 'public-contact',
  contactDescription:
    'Use this contact form to send us a direct request. Include a short title, your message, and your email so we can reply.',
  contactMode: 'full',
  contactTitle: 'Contact us',
  description:
    'findmydoc is launching a clearer way to compare clinics abroad. This immersive hero is built to showcase a premium background video with minimal distraction.',
  eyebrow: 'Clinic comparison starts with structured information',
  footerLinks,
  heroVideo: {
    ctaHref: '#contact',
    crossfadeMs: 700,
    playbackRate: 0.78,
    posterSrc: storyClinicImages.listing.exterior,
    videoBlurPx: 2.2,
    videoSrc: '/stories/immersive-hero-loop.mp4',
    requiredLabel: 'Background video currently unavailable',
    subheadlineText: 'Compare clinic-provided profiles, listed services, and contact options.',
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
    'findmydoc is designed for people who want to compare clinic information abroad before making contact. Instead of switching between fragmented websites, patients can review structured clinic profiles, treatment options, listed services, and contact options in one comparison flow.\n\nThe goal is to make clinic research easier to understand and easier to act on. By organizing clinic-provided information, specialty fit, and direct contact paths, this layout supports clearer next steps.',
  overlayClassName: 'from-white/94 via-sky-50/68 to-white/88',
  primaryCtaLabel: 'Send message',
  searchSnapshot: {
    internalLinks,
    metaDescription:
      'findmydoc helps you compare clinic-provided information abroad with clearer choices and a direct next step.',
    metaTitle: 'findmydoc Launch | Compare Clinics Abroad',
    primaryKeyword: 'compare clinics abroad',
    searchIntent: 'Comparative with launch-intent trust',
  },
  signals: [
    {
      title: 'Compare clinic profiles',
      body: 'Review treatment options, specialties, and transparent profile data side by side before making contact.',
      icon: UserRoundSearch,
    },
    {
      title: 'Review comparable information',
      body: 'Use listed services, languages, locations, and contact paths to organize clinic research.',
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
