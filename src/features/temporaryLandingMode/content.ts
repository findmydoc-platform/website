import type { HoldingPageConceptProps } from '@/components/templates/HoldingPageConcept'
import { ArrowLeftRight, ShieldCheck, UserRoundSearch } from 'lucide-react'

const footerLinks: HoldingPageConceptProps['footerLinks'] = [
  { href: '/privacy-policy', label: 'Privacy Policy', appearance: 'inline' },
  { href: '/imprint', label: 'Imprint', appearance: 'inline' },
]

const internalLinks: HoldingPageConceptProps['searchSnapshot']['internalLinks'] = [
  { href: '/listing-comparison', label: 'Compare clinics by treatment', appearance: 'inline' },
  { href: '/posts', label: 'Clinic quality signals explained', appearance: 'inline' },
  { href: '/partners/clinics', label: 'Medical travel treatment guides', appearance: 'inline' },
]

export const temporaryLandingPageContent: HoldingPageConceptProps = {
  backgroundImage: '',
  bestFor: '',
  contactDescription:
    'Use this contact form to send us a direct request. Include a short title, your message, and your email so we can reply.',
  contactMode: 'full',
  contactTitle: 'Contact us',
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
    'Findmydoc is designed for people who want to compare clinics abroad with more confidence before making a medical travel decision. Instead of switching between fragmented websites, patients can review structured clinic profiles, treatment options, and transparent quality signals in one comparison flow.\n\nThe goal is to make clinic research easier to understand, easier to verify, and easier to act on. By combining verification status, patient reviews, listed accreditations, and specialty fit, this layout supports clearer expectations and more informed next steps. The section also keeps legal transparency visible through direct links to Privacy Policy and Imprint, while still preserving a calm, focused reading experience below the hero.',
  overlayClassName: 'from-white/94 via-sky-50/68 to-white/88',
  primaryCtaLabel: 'Send message',
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
