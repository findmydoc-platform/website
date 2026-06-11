import type React from 'react'
import type { Metadata } from 'next'
import { CheckCircle, Eye, Target, TrendingUp } from 'lucide-react'

import type { FAQItem } from '@/components/organisms/FAQ'
import type { LandingPricingModelItem, LandingPricingPlan } from '@/components/organisms/Landing/LandingPricing'
import type { LandingTestimonial } from '@/components/organisms/Landing/LandingTestimonials.types'
import { resolveHrefFromCMSLink } from '@/blocks/_shared/utils'
import type { LandingPage, PlatformContentMedia } from '@/payload-types'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { resolveMediaImage, type ResolvedMediaImage } from '@/utilities/media/resolveMediaImage'
import { landingSocialHosts, normalizeSafeLandingHref } from './safeLandingHref'

type LandingFeatureIcon = LandingPage['home']['features']['items'][number]['icon']

type LandingFeature = {
  title: string
  subtitle?: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

type LandingProcessStep = {
  step: number
  title: string
  description: string
}

type LandingProcessStepImage = ResolvedMediaImage

type SectionIntro = {
  title: string
  description: string
}

type LandingHeroContent = SectionIntro & {
  image: ResolvedMediaImage
}

type LandingFaqContent = SectionIntro & {
  items: FAQItem[]
}

type LandingProcessContent = {
  title: string
  subtitle: string
  steps: LandingProcessStep[]
  stepImages: LandingProcessStepImage[]
}

type LandingTeamMember = {
  name: string
  role: string
  image: string
  imageObjectPosition?: string
  isPhoto?: boolean
  photoDisplay?: 'original' | 'grayscale'
  socials?: {
    github?: string
    instagram?: string
    linkedin?: string
    meta?: string
    x?: string
  }
}

type AboutGlobal = NonNullable<LandingPage['about']>
type AboutGlobalTextSection = {
  title?: string | null
  items?: Array<{ text: string }> | null
}

type AboutStatementItem = {
  text: string
}

type AboutTextSection = {
  title: string
  items: AboutStatementItem[]
}

type AboutTeamMember = {
  name: string
  role: string
  whatWeDo: string
  image: ResolvedMediaImage
}

export type HomeLandingContent = {
  metadata: Metadata
  hero: LandingHeroContent
  testimonials: LandingTestimonial[]
  testimonialsIntro: SectionIntro
  categoriesIntro: SectionIntro
  features: SectionIntro & {
    backgroundImage: string
    items: LandingFeature[]
  }
  process: LandingProcessContent
  faq: LandingFaqContent
  blogTeaser: SectionIntro
  contact: SectionIntro
}

export type AboutLandingContent = {
  metadata: Metadata
  hero: LandingHeroContent
  why: AboutTextSection
  team: AboutTeamMember[]
  transparency: AboutTextSection
}

export type ClinicPartnerLandingContent = {
  metadata: Metadata
  hero: LandingHeroContent
  features: SectionIntro & {
    items: LandingFeature[]
  }
  process: LandingProcessContent
  categoriesIntro: SectionIntro
  cta: {
    title: string
    buttonText: string
    buttonLink: string
  }
  team: LandingTeamMember[]
  teamIntro: SectionIntro
  testimonials: LandingTestimonial[]
  testimonialsIntro: SectionIntro
  pricing: SectionIntro & {
    plans: LandingPricingPlan[]
  }
  pricingModel: LandingPricingModelItem[]
  faq: LandingFaqContent
  blogTeaser: SectionIntro
  contact: SectionIntro
}

export const DEFAULT_LANDING_PAGE_GLOBAL = {
  home: {
    seo: {
      title: 'Gain International Patients | Global Clinic Visibility Platform',
      description:
        'Gain international patients through a trusted comparison platform. Increase clinic reach, visibility, and qualified global patient inquiries.',
    },
    hero: {
      title: 'Clinic Comparison Turkey for Aesthetic Treatments',
      description:
        'Compare selected aesthetic clinics in Turkey in a transparent and structured way. Our platform helps you understand treatment options, review clinic information and contact clinics directly with confidence.',
    },
    testimonials: [
      {
        quote:
          'The platform makes treatment research easier by structuring clinic details around what patients need before deciding.',
        author: 'Maya Bennett',
        role: 'Digital Health Research Advisor',
      },
      {
        quote:
          'I appreciate how trust signals are integrated into the comparison flow instead of being hidden in long profile text.',
        author: 'Daniel Ortega',
        role: 'Healthcare UX Reviewer',
      },
      {
        quote:
          'For users planning treatment abroad, the direct contact step is clear, practical, and aligned with real decision journeys.',
        author: 'Sophie Klein',
        role: 'International Care Pathway Consultant',
      },
    ],
    categoriesIntro: {
      title: 'Categories',
      description: 'Explore verified clinics by specialty and compare the best options for your needs.',
    },
    features: {
      title: 'Benefits for Patients',
      description:
        'Compare verified clinics for dental care, hair transplants, and aesthetic treatments with clear trust signals and transparent profile data.',
      items: [
        {
          title: 'Qualified Leads',
          subtitle: '',
          description:
            'Compare aesthetic clinics based on treatments, specializations and qualifications. All information is presented clearly to support informed decision making.',
          icon: 'checkCircle',
        },
        {
          title: 'Reputation Boost',
          subtitle: '',
          description:
            'Clinics create and manage their own profiles and provide relevant qualifications according to their aesthetic services. This ensures reliable and comparable information.',
          icon: 'trendingUp',
        },
        {
          title: 'Visibility Increase',
          subtitle: '',
          description: 'Patients contact clinics directly without intermediaries, obligations or hidden fees.',
          icon: 'eye',
        },
      ],
    },
    process: {
      title: 'How It Works for Patients',
      subtitle: 'A transparent onboarding flow from profile setup to verified visibility and direct patient inquiries.',
      steps: [
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
      ],
    },
    faq: {
      title: 'FAQ',
      description:
        'This section answers the most common questions clinics and medical networks have about gaining international patients through our comparison platform.',
      items: [
        {
          question: 'How does this platform help clinics gain international patients?',
          answer:
            'By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.',
        },
        {
          question: 'Are the patient inquiries exclusive?',
          answer: 'Inquiries are handled according to your clinic profile settings and availability.',
        },
        {
          question: 'Which countries and regions are covered?',
          answer: 'Coverage depends on active campaigns and regional demand at the time of listing.',
        },
        {
          question: 'Is this platform suitable for clinic groups and networks?',
          answer: 'Yes. Groups can maintain consistent branding while showcasing individual locations.',
        },
        {
          question: 'Are patient inquiries focused on Europe?',
          answer: 'Demand is strongest across Europe, but can include other regions depending on campaigns.',
        },
      ],
    },
    blogTeaser: {
      title: 'From our blog',
      description: 'Explore practical insights, expert perspectives, and the latest topics across health and medicine.',
    },
    contact: {
      title: 'Contact',
      description:
        'Planning treatment abroad? Share your goals and we will help you find relevant clinics and next steps with confidence.',
    },
  },
  clinicPartners: {
    seo: {
      title: 'For Partner Clinics | findmydoc',
      description:
        'Increase your clinic’s international reach and connect with qualified patients worldwide. Our comparison platform helps clinics, medical networks, and international patient departments gain visibility, trust, and high-intent inquiries - globally and sustainably.',
    },
    hero: {
      title: 'Gain International Patients Through a Trusted Global Clinic Platform',
      description:
        'Increase your clinic’s international reach and connect with qualified patients worldwide. Our comparison platform helps clinics, medical networks, and international patient departments gain visibility, trust, and high-intent inquiries - globally and sustainably.',
    },
    features: {
      title: 'Features',
      description:
        'Increase your clinic’s visibility, attract qualified patients, and grow internationally through transparent, verified profiles.',
      items: [
        {
          title: 'Qualified Leads',
          subtitle: 'Easy & Robust',
          description:
            'Receive patient inquiries from users actively comparing clinics and treatments. Only relevant and treatment focused leads.',
          icon: 'target',
        },
        {
          title: 'Reputation Boost',
          subtitle: 'Huge Collection',
          description:
            'Strengthen your clinic’s credibility through verified qualifications and transparent profiles that build trust with international patients.',
          icon: 'trendingUp',
        },
        {
          title: 'Visibility Increase',
          subtitle: 'Responsive & Retina',
          description:
            'Increase your clinic’s visibility where international patients search, compare and decide across the DACH region.',
          icon: 'eye',
        },
      ],
    },
    process: {
      title: 'Our Process',
      subtitle: 'A transparent onboarding flow from profile setup to verified visibility and direct patient inquiries.',
      steps: [
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
      ],
    },
    categoriesIntro: {
      title: 'Our Categories',
      description: 'Showcase your clinic under the categories patients search most.',
    },
    cta: {
      title: 'Let’s work together',
      buttonText: 'Contact us',
      link: {
        type: 'custom',
        newTab: false,
        url: '/contact',
      },
    },
    team: [
      {
        name: 'Volkan Kablan',
        role: 'CEO',
        isPhoto: true,
        photoDisplay: 'original',
        socials: { meta: '#', x: '#', instagram: '#', linkedin: '#', github: '#' },
      },
      {
        name: 'Youssef Adlah',
        role: 'CMO',
        isPhoto: true,
        photoDisplay: 'original',
        socials: { meta: '#', x: '#', instagram: '#', linkedin: '#', github: '#' },
      },
      {
        name: 'Anil Gökduman',
        role: 'CPO',
        isPhoto: true,
        socials: { meta: '#', x: '#', instagram: '#', linkedin: '#', github: '#' },
      },
      {
        name: 'Özen Günes',
        role: 'CLO',
        isPhoto: true,
        socials: { meta: '#', x: '#', instagram: '#', linkedin: '#', github: '#' },
      },
      {
        name: 'Sebastian Schütze',
        role: 'CTO',
        isPhoto: true,
        socials: { meta: '#', x: '#', instagram: '#', linkedin: '#', github: '#' },
      },
    ],
    testimonials: [
      {
        quote:
          'The clinic onboarding model is well structured and sets clear expectations for profile quality and international visibility.',
        author: 'Alex Morgan',
        role: 'Clinic Growth Advisor',
      },
      {
        quote:
          'I like that the positioning is not lead-reselling but direct patient contact supported by transparent clinic information.',
        author: 'Nina Feld',
        role: 'International Patient Services Consultant',
      },
      {
        quote:
          'From an operations perspective, the process is practical: present verified strengths, compare clearly, and move into qualified conversations.',
        author: 'Robert Hayes',
        role: 'Healthcare Operations Reviewer',
      },
    ],
    pricing: {
      title: 'Pricing',
      description:
        'Choose the monthly tier that matches your growth stage. Performance-based commission and optional add-ons sit alongside the subscription model.',
      plans: [
        {
          price: 'EUR 199',
          billingLabel: '/ month',
          plan: 'Premium',
          description:
            'For clinics that want stronger category visibility, a more competitive profile presence, and a reliable stream of qualified international inquiries.',
          highlights: [
            { text: 'Priority profile visibility' },
            { text: 'Enhanced trust and profile depth' },
            { text: 'Built for clinics scaling inbound demand' },
          ],
          buttonText: 'Choose Premium',
          badge: 'Most popular',
          layout: 'primary',
        },
        {
          price: 'EUR 349',
          billingLabel: '/ month',
          plan: 'Pro',
          description:
            'For established clinics and networks that need the strongest presentation, highest visibility, and a structure ready for more active international growth.',
          highlights: [
            { text: 'Highest visibility tier' },
            { text: 'Best fit for multi-market growth' },
            { text: 'Designed for advanced partner collaboration' },
          ],
          buttonText: 'Talk to us about Pro',
          layout: 'primary',
        },
        {
          price: 'EUR 99',
          billingLabel: '/ month',
          plan: 'Basic',
          description:
            'A focused entry plan for clinics that want to get listed, present core strengths clearly, and start testing international demand without a heavy commitment.',
          highlights: [
            { text: 'Lean monthly entry point' },
            { text: 'Clear profile presence' },
            { text: 'Good fit for first traction' },
          ],
          buttonText: 'Start with Basic',
          layout: 'compact',
        },
      ],
    },
    pricingModel: [
      {
        title: 'Monthly subscription tiers',
        description: 'Basic, Premium, and Pro cover ongoing visibility, profile management, and partner presence.',
      },
      {
        title: 'Performance-based commission',
        description: 'A variable fee can apply on successful patient cases, separate from the monthly subscription.',
      },
      {
        title: 'Optional add-ons',
        description: 'Extra visibility or support modules can be added without bloating the base pricing cards.',
      },
    ],
    faq: {
      title: 'FAQ',
      description:
        'This section answers the most common questions clinics and medical networks have about gaining international patients through our comparison platform. It provides clarity on regions, qualifications, visibility and how clinics connect with international patients across the DACH region and Europe.',
      items: [
        {
          question: 'How does this platform help clinics gain international patients?',
          answer:
            'By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.',
        },
        {
          question: 'Are the patient inquiries exclusive?',
          answer: 'Patients contact clinics directly. There are no resold or recycled leads.',
        },
        {
          question: 'Which countries and regions are covered?',
          answer:
            'Our primary focus is the DACH region (Germany, Austria, Switzerland), while also supporting international patient acquisition across Europe.',
        },
        {
          question: 'Is this platform suitable for clinic groups and networks?',
          answer:
            'Yes. We support single clinics, clinic groups, and medical networks with scalable visibility options.',
        },
        {
          question: 'Are patient inquiries focused on Europe?',
          answer:
            'Most inquiries originate from patients seeking treatment within Europe, with a strong focus on the DACH region.',
        },
      ],
    },
    blogTeaser: {
      title: 'From our blog',
      description: 'Explore practical insights, expert perspectives, and the latest topics across health and medicine.',
    },
    contact: {
      title: 'Kontakt',
      description:
        'Interested in gaining international patients and increasing your clinic’s global reach? Contact us to explore how your clinic can benefit from our international comparison platform.',
    },
  },
  about: {
    seo: {
      title: 'About findmydoc | The team behind clearer clinic decisions',
      description:
        'Meet the team behind findmydoc and learn how we make clinic information clearer, more accountable, and easier to compare.',
    },
    hero: {
      title: 'Clearer clinic decisions start with better information.',
      description:
        'findmydoc helps patients compare clinic information with confidence and helps clinics present their services responsibly.',
    },
    why: {
      title: 'Why we exist',
      items: [
        {
          text: 'We bring clarity to clinic information so comparisons are fair and decisions are easier.',
        },
        {
          text: 'We hold clinic information accountable through verification and responsible presentation.',
        },
        {
          text: 'We keep the next step simple by connecting patients and clinics directly.',
        },
      ],
    },
    team: [
      {
        name: 'Volkan Kablan',
        role: 'CEO',
        whatWeDo:
          'Shape finance and partner operations so clinic growth stays sustainable, measurable, and transparent.',
      },
      {
        name: 'Youssef Adlah',
        role: 'CMO',
        whatWeDo:
          'Lead growth and partnerships to connect the right patients with the right clinics through clear communication and strong relationships.',
      },
      {
        name: 'Anil Gökduman',
        role: 'CPO',
        whatWeDo:
          'Own product strategy and user experience to make clinic comparisons simple, relevant, and trustworthy for patients.',
      },
      {
        name: 'Özen Günes',
        role: 'CLO',
        whatWeDo:
          'Ensure legal integrity, data protection, and responsible engagement across all our relationships with patients and clinics.',
      },
      {
        name: 'Sebastian Schütze',
        role: 'CTO',
        whatWeDo:
          'Build and maintain a secure, reliable platform so clinic information is structured, up to date, and easy to access.',
      },
    ],
    transparency: {
      title: 'What we keep transparent',
      items: [
        {
          text: 'Clinics own their profile information.',
        },
        {
          text: 'Qualification signals are reviewed before visibility.',
        },
        {
          text: 'Patients contact clinics directly.',
        },
      ],
    },
  },
}

const landingFeatureIcons: Record<LandingFeatureIcon, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  checkCircle: CheckCircle,
  eye: Eye,
  target: Target,
  trendingUp: TrendingUp,
}

const asLoadedMedia = (media: unknown): PlatformContentMedia | null =>
  media && typeof media === 'object' ? (media as PlatformContentMedia) : null

const optionalText = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined
  return value.trim().length > 0 ? value : undefined
}

const resolveRequiredLandingImage = (media: unknown, fieldPath: string, fallbackAlt: string): ResolvedMediaImage => {
  const image = resolveMediaImage(asLoadedMedia(media), {
    fallbackAlt,
    usage: 'landingVisual',
  })

  if (!image?.src) {
    throw new Error(`Landing media ${fieldPath} is missing or not populated`)
  }

  return image
}

const normalizeFeatures = (
  items: LandingPage['home']['features']['items'] | undefined,
  fallbackItems: LandingPage['home']['features']['items'],
): LandingFeature[] => {
  const source = items && items.length > 0 ? items : fallbackItems

  return source.map((item) => ({
    title: item.title,
    subtitle: optionalText(item.subtitle),
    description: item.description,
    icon: landingFeatureIcons[item.icon] ?? landingFeatureIcons.checkCircle,
  }))
}

const normalizeTestimonials = (
  testimonials: LandingPage['home']['testimonials'] | undefined,
  fallbackTestimonials: LandingPage['home']['testimonials'],
  fieldPath: string,
): LandingTestimonial[] => {
  const source = testimonials && testimonials.length > 0 ? testimonials : fallbackTestimonials

  return source.map((testimonial, index) => {
    const image = resolveRequiredLandingImage(testimonial.image, `${fieldPath}.${index}.image`, testimonial.author)

    return {
      quote: testimonial.quote,
      author: testimonial.author,
      role: testimonial.role,
      image: image.src,
    }
  })
}

const normalizeFaq = (faq: LandingPage['home']['faq'], fallbackFaq: LandingPage['home']['faq']): LandingFaqContent => {
  const sourceItems = faq.items.length > 0 ? faq.items : fallbackFaq.items

  return {
    title: faq.title || fallbackFaq.title,
    description: faq.description || fallbackFaq.description,
    items: sourceItems.map((item, index) => ({
      id: optionalText(item.id) ?? `faq-${index + 1}`,
      question: item.question,
      answer: item.answer,
    })),
  }
}

const normalizeProcess = (
  process: LandingPage['home']['process'],
  fallbackProcess: LandingPage['home']['process'],
  fieldPath: string,
): LandingProcessContent => {
  const sourceSteps = process.steps.length > 0 ? process.steps : fallbackProcess.steps

  return {
    title: process.title || fallbackProcess.title,
    subtitle: process.subtitle || fallbackProcess.subtitle,
    steps: sourceSteps.map((step) => ({
      step: step.step,
      title: step.title,
      description: step.description,
    })),
    stepImages: sourceSteps.map((step, index) =>
      resolveRequiredLandingImage(step.image, `${fieldPath}.steps.${index}.image`, step.title),
    ),
  }
}

const normalizePricingPlans = (plans: LandingPage['clinicPartners']['pricing']['plans']): LandingPricingPlan[] =>
  plans.map((plan) => ({
    price: plan.price,
    billingLabel: optionalText(plan.billingLabel),
    plan: plan.plan,
    description: plan.description,
    highlights: plan.highlights?.map((highlight) => highlight.text) ?? undefined,
    buttonText: plan.buttonText,
    badge: optionalText(plan.badge),
    layout: plan.layout,
  }))

const normalizeTeam = (
  team: LandingPage['clinicPartners']['team'],
  fieldPath = 'clinicPartners.team',
): LandingTeamMember[] =>
  team.map((member, index) => {
    const image = resolveRequiredLandingImage(member.image, `${fieldPath}.${index}.image`, member.name)

    return {
      name: member.name,
      role: member.role,
      image: image.src,
      ...(image.objectPosition ? { imageObjectPosition: image.objectPosition } : {}),
      isPhoto: member.isPhoto ?? true,
      photoDisplay: member.photoDisplay ?? 'grayscale',
      socials: {
        github: normalizeSafeLandingHref(member.socials?.github, { allowedHosts: landingSocialHosts.github }),
        instagram: normalizeSafeLandingHref(member.socials?.instagram, { allowedHosts: landingSocialHosts.instagram }),
        linkedin: normalizeSafeLandingHref(member.socials?.linkedin, { allowedHosts: landingSocialHosts.linkedin }),
        meta: normalizeSafeLandingHref(member.socials?.meta, { allowedHosts: landingSocialHosts.meta }),
        x: normalizeSafeLandingHref(member.socials?.x, { allowedHosts: landingSocialHosts.x }),
      },
    }
  })

const normalizeAboutTeam = (
  team: AboutGlobal['team'] | undefined,
  fallbackTeam: AboutGlobal['team'],
  fieldPath = 'about.team',
): AboutTeamMember[] => {
  const source = team && team.length > 0 ? team : fallbackTeam

  return source.map((member, index) => ({
    name: member.name,
    role: member.role,
    whatWeDo: member.whatWeDo,
    image: resolveRequiredLandingImage(member.image, `${fieldPath}.${index}.image`, member.name),
  }))
}

const normalizeAboutTeamForLanding = (team: AboutGlobal['team'], fieldPath = 'about.team'): LandingTeamMember[] =>
  team.map((member, index) => {
    const image = resolveRequiredLandingImage(member.image, `${fieldPath}.${index}.image`, member.name)

    return {
      name: member.name,
      role: member.role,
      image: image.src,
      ...(image.objectPosition ? { imageObjectPosition: image.objectPosition } : {}),
      isPhoto: true,
      photoDisplay: 'original',
    }
  })

const normalizeAboutTextSection = (
  section: AboutGlobalTextSection | undefined,
  fallbackSection: AboutGlobalTextSection,
): AboutTextSection => {
  const sourceItems = section?.items && section.items.length > 0 ? section.items : (fallbackSection.items ?? [])

  return {
    title: optionalText(section?.title) ?? optionalText(fallbackSection.title) ?? '',
    items: sourceItems.map((item) => ({ text: item.text })),
  }
}

const normalizeLandingCtaButtonLink = (cta: LandingPage['clinicPartners']['cta']): string => {
  const safeHref = normalizeSafeLandingHref(resolveHrefFromCMSLink(cta.link), { allowInternalPath: true })

  if (!safeHref) {
    throw new Error('Landing CTA link is missing or unsafe')
  }

  return safeHref
}

export const normalizeHomeLandingContent = (landingPages: LandingPage = DEFAULT_LANDING_PAGE_GLOBAL as LandingPage) => {
  const fallbackHome = DEFAULT_LANDING_PAGE_GLOBAL.home as LandingPage['home']
  const home = landingPages.home ?? fallbackHome

  return {
    metadata: {
      title: home.seo.title || fallbackHome.seo.title,
      description: home.seo.description || fallbackHome.seo.description,
    },
    hero: {
      title: home.hero.title || fallbackHome.hero.title,
      description: home.hero.description || fallbackHome.hero.description,
      image: resolveRequiredLandingImage(
        home.hero.image,
        'home.hero.image',
        home.hero.title || fallbackHome.hero.title,
      ),
    },
    testimonials: normalizeTestimonials(home.testimonials, fallbackHome.testimonials, 'home.testimonials'),
    testimonialsIntro: {
      title: 'Expert feedback',
      description: 'Perspectives from healthcare and product experts who reviewed the patient decision flow.',
    },
    categoriesIntro: home.categoriesIntro,
    features: {
      title: home.features.title || fallbackHome.features.title,
      description: home.features.description || fallbackHome.features.description,
      backgroundImage: resolveRequiredLandingImage(
        home.features.backgroundImage,
        'home.features.backgroundImage',
        home.features.title || fallbackHome.features.title,
      ).src,
      items: normalizeFeatures(home.features.items, fallbackHome.features.items),
    },
    process: normalizeProcess(home.process, fallbackHome.process, 'home.process'),
    faq: normalizeFaq(home.faq, fallbackHome.faq),
    blogTeaser: home.blogTeaser,
    contact: home.contact,
  } satisfies HomeLandingContent
}

export const normalizeAboutLandingContent = (
  landingPages: LandingPage = DEFAULT_LANDING_PAGE_GLOBAL as LandingPage,
) => {
  const fallbackAbout = DEFAULT_LANDING_PAGE_GLOBAL.about as AboutGlobal
  const about = landingPages.about ?? fallbackAbout

  return {
    metadata: {
      title: about.seo.title || fallbackAbout.seo.title,
      description: about.seo.description || fallbackAbout.seo.description,
    },
    hero: {
      title: about.hero.title || fallbackAbout.hero.title,
      description: about.hero.description || fallbackAbout.hero.description,
      image: resolveRequiredLandingImage(
        about.hero.image,
        'about.hero.image',
        about.hero.title || fallbackAbout.hero.title,
      ),
    },
    why: normalizeAboutTextSection(about.why, fallbackAbout.why),
    team: normalizeAboutTeam(about.team, fallbackAbout.team),
    transparency: normalizeAboutTextSection(about.transparency, fallbackAbout.transparency),
  } satisfies AboutLandingContent
}

export const normalizeClinicPartnerLandingContent = (
  landingPages: LandingPage = DEFAULT_LANDING_PAGE_GLOBAL as LandingPage,
) => {
  const fallbackClinicPartners = DEFAULT_LANDING_PAGE_GLOBAL.clinicPartners as LandingPage['clinicPartners']
  const clinicPartners = landingPages.clinicPartners ?? fallbackClinicPartners
  const about = landingPages.about
  const aboutTeam = about?.team && about.team.length > 0 ? about.team : undefined

  return {
    metadata: {
      title: clinicPartners.seo.title || fallbackClinicPartners.seo.title,
      description: clinicPartners.seo.description || fallbackClinicPartners.seo.description,
    },
    hero: {
      title: clinicPartners.hero.title || fallbackClinicPartners.hero.title,
      description: clinicPartners.hero.description || fallbackClinicPartners.hero.description,
      image: resolveRequiredLandingImage(
        clinicPartners.hero.image,
        'clinicPartners.hero.image',
        clinicPartners.hero.title || fallbackClinicPartners.hero.title,
      ),
    },
    features: {
      title: clinicPartners.features.title || fallbackClinicPartners.features.title,
      description: clinicPartners.features.description || fallbackClinicPartners.features.description,
      items: normalizeFeatures(clinicPartners.features.items, fallbackClinicPartners.features.items),
    },
    process: normalizeProcess(clinicPartners.process, fallbackClinicPartners.process, 'clinicPartners.process'),
    categoriesIntro: clinicPartners.categoriesIntro,
    cta: {
      title: clinicPartners.cta.title || fallbackClinicPartners.cta.title,
      buttonText: clinicPartners.cta.buttonText || fallbackClinicPartners.cta.buttonText,
      buttonLink: normalizeLandingCtaButtonLink(clinicPartners.cta),
    },
    team: aboutTeam
      ? normalizeAboutTeamForLanding(aboutTeam)
      : normalizeTeam(clinicPartners.team.length > 0 ? clinicPartners.team : fallbackClinicPartners.team),
    teamIntro: {
      title: 'Our Team',
      description:
        'We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology. Our focus is simple: helping clinics gain international patients in a sustainable, ethical, and measurable way.',
    },
    testimonials: normalizeTestimonials(
      clinicPartners.testimonials,
      fallbackClinicPartners.testimonials,
      'clinicPartners.testimonials',
    ),
    testimonialsIntro: {
      title: 'Testimonials',
      description:
        'Feedback from healthcare and clinic growth experts who reviewed the partner onboarding and visibility model.',
    },
    pricing: {
      title: clinicPartners.pricing.title || fallbackClinicPartners.pricing.title,
      description: clinicPartners.pricing.description || fallbackClinicPartners.pricing.description,
      plans: normalizePricingPlans(
        clinicPartners.pricing.plans.length > 0 ? clinicPartners.pricing.plans : fallbackClinicPartners.pricing.plans,
      ),
    },
    pricingModel: (clinicPartners.pricingModel ?? fallbackClinicPartners.pricingModel ?? []).map((item) => ({
      title: item.title,
      description: item.description,
    })),
    faq: normalizeFaq(clinicPartners.faq, fallbackClinicPartners.faq),
    blogTeaser: clinicPartners.blogTeaser,
    contact: clinicPartners.contact,
  } satisfies ClinicPartnerLandingContent
}

export const getHomeLandingContent = async (): Promise<HomeLandingContent> => {
  const landingPages = (await getCachedGlobal('landingPages', 2)()) as LandingPage | null | undefined

  return normalizeHomeLandingContent(landingPages ?? (DEFAULT_LANDING_PAGE_GLOBAL as LandingPage))
}

export const getAboutLandingContent = async (): Promise<AboutLandingContent> => {
  const landingPages = (await getCachedGlobal('landingPages', 2)()) as LandingPage | null | undefined

  return normalizeAboutLandingContent(landingPages ?? (DEFAULT_LANDING_PAGE_GLOBAL as LandingPage))
}

export const getClinicPartnerLandingContent = async (): Promise<ClinicPartnerLandingContent> => {
  const landingPages = (await getCachedGlobal('landingPages', 2)()) as LandingPage | null | undefined

  return normalizeClinicPartnerLandingContent(landingPages ?? (DEFAULT_LANDING_PAGE_GLOBAL as LandingPage))
}
