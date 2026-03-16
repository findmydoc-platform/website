import type { HoldingPageConceptProps } from '@/components/templates/HoldingPageConcept'
import { ArrowLeftRight, ShieldCheck, UserRoundSearch } from 'lucide-react'

const footerLinks: HoldingPageConceptProps['footerLinks'] = [
  { href: '/privacy-policy', label: 'Privacy Policy', appearance: 'inline' },
  { href: '/imprint', label: 'Imprint', appearance: 'inline' },
]

const internalLinks: HoldingPageConceptProps['searchSnapshot']['internalLinks'] = [
  { href: '/listing-comparison', label: 'Compare clinics', appearance: 'inline' },
  { href: '/posts', label: 'Treatment guides', appearance: 'inline' },
  { href: '/partners/clinics', label: 'For clinics', appearance: 'inline' },
]

export const temporaryLandingPageContent: HoldingPageConceptProps = {
  backgroundImage: '',
  bestFor: '',
  contactDescription:
    'Join the launch updates list to get early access as soon as findmydoc becomes publicly available.',
  contactMode: 'compact',
  contactTitle: 'Get launch updates',
  description:
    'findmydoc is preparing a clearer way to compare clinics abroad. Review trusted quality signals and make decisions with confidence.',
  eyebrow: 'Compare clinics abroad with trusted quality signals',
  footerLinks,
  heroVideo: {
    ctaHref: '#contact',
    crossfadeMs: 700,
    playbackRate: 0.88,
    posterSrc: '/images/landing/home-hero-telemedicine.jpg',
    videoSrc: '/stories/immersive-hero-loop.mp4',
    requiredLabel: 'Background video currently unavailable',
    subheadlineText: 'Find verified clinics, compare quality signals, and choose your next step with clarity.',
    useReducedMotionFallback: true,
    withCrossfade: true,
  },
  layoutMode: 'video',
  mediaNote: {
    badge: 'Verified comparison',
    description:
      'A calm, high-quality video backdrop supports readability while keeping the focus on trust and informed treatment decisions.',
    title: 'Trusted clinic comparison starts with clear information.',
  },
  narrative:
    'findmydoc brings verified clinic data, treatment context, and transparent quality signals together so patients can compare options before making contact.',
  overlayClassName: 'from-white/94 via-sky-50/68 to-white/88',
  primaryCtaLabel: 'Join launch updates',
  searchSnapshot: {
    internalLinks,
    metaDescription:
      'Compare clinics abroad with trusted quality information, transparent profiles, and a clear next step before treatment.',
    metaTitle: 'findmydoc | Compare Clinics Abroad',
    primaryKeyword: 'compare clinics abroad',
    searchIntent: 'Comparative with trust-focused launch intent',
  },
  signals: [
    {
      title: 'Compare verified clinics',
      body: 'Review treatments, specialties, and profile information side by side before contacting a clinic.',
      icon: UserRoundSearch,
    },
    {
      title: 'Trust through quality signals',
      body: 'Use ratings, reviews, verification status, and accreditations to evaluate options with more confidence.',
      icon: ShieldCheck,
    },
    {
      title: 'Direct clinic contact',
      body: 'Contact clinics directly without intermediaries and discuss next steps based on your treatment needs.',
      icon: ArrowLeftRight,
    },
  ],
  specialties: ['Dental', 'Eye Care', 'Hair Restoration', 'Plastic Surgery'],
  statusLabel: 'Coming Soon',
  supportingNote: '',
  themeName: 'Temporary public landing',
  title: 'A clearer way to compare clinics abroad is coming soon.',
  visualVariant: 'videoImmersiveHero',
}
