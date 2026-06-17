import type React from 'react'
import type { Metadata } from 'next'
import { CheckCircle, Eye, Target, TrendingUp } from 'lucide-react'

import type { FAQItem } from '@/components/organisms/FAQ'
import type { LandingPricingModelItem, LandingPricingPlan } from '@/components/organisms/Landing/LandingPricing'
import type { LandingTestimonial } from '@/components/organisms/Landing/LandingTestimonials.types'
import { resolveHrefFromCMSLink } from '@/blocks/_shared/utils'
import type { LandingPage, PlatformContentMedia } from '@/payload-types'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { resolveMediaImage, type MediaImageUsage, type ResolvedMediaImage } from '@/utilities/media/resolveMediaImage'
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

const requireLandingPagesGlobal = (landingPages: LandingPage | null | undefined): LandingPage => {
  if (!landingPages) {
    throw new Error('Landing pages global is missing. Run the baseline seed before rendering landing routes.')
  }

  return landingPages
}

const requireLandingSection = <T>(value: T | null | undefined, fieldPath: string): T => {
  if (!value) {
    throw new Error(`Landing pages global field ${fieldPath} is missing`)
  }

  return value
}

const requireLandingArray = <T>(value: T[] | null | undefined, fieldPath: string): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Landing pages global field ${fieldPath} is missing`)
  }

  return value
}

const resolveRequiredLandingImage = (
  media: unknown,
  fieldPath: string,
  fallbackAlt: string,
  usage: MediaImageUsage = 'landingVisual',
): ResolvedMediaImage => {
  const image = resolveMediaImage(asLoadedMedia(media), {
    fallbackAlt,
    usage,
  })

  if (!image?.src) {
    throw new Error(`Landing media ${fieldPath} is missing or not populated`)
  }

  return image
}

const normalizeFeatures = (
  items: LandingPage['home']['features']['items'] | null | undefined,
  fieldPath: string,
): LandingFeature[] =>
  requireLandingArray(items, fieldPath).map((item) => ({
    title: item.title,
    subtitle: optionalText(item.subtitle),
    description: item.description,
    icon: landingFeatureIcons[item.icon] ?? landingFeatureIcons.checkCircle,
  }))

const normalizeTestimonials = (
  testimonials: LandingPage['home']['testimonials'] | null | undefined,
  fieldPath: string,
): LandingTestimonial[] => {
  return requireLandingArray(testimonials, fieldPath).map((testimonial, index) => {
    const image = resolveRequiredLandingImage(testimonial.image, `${fieldPath}.${index}.image`, testimonial.author)

    return {
      quote: testimonial.quote,
      author: testimonial.author,
      role: testimonial.role,
      image: image.src,
    }
  })
}

const normalizeFaq = (faq: LandingPage['home']['faq'], fieldPath: string): LandingFaqContent => ({
  title: faq.title,
  description: faq.description,
  items: requireLandingArray(faq.items, `${fieldPath}.items`).map((item, index) => ({
    id: optionalText(item.id) ?? `faq-${index + 1}`,
    question: item.question,
    answer: item.answer,
  })),
})

const normalizeProcess = (process: LandingPage['home']['process'], fieldPath: string): LandingProcessContent => ({
  title: process.title,
  subtitle: process.subtitle,
  steps: requireLandingArray(process.steps, `${fieldPath}.steps`).map((step) => ({
    step: step.step,
    title: step.title,
    description: step.description,
  })),
  stepImages: requireLandingArray(process.steps, `${fieldPath}.steps`).map((step, index) =>
    resolveRequiredLandingImage(step.image, `${fieldPath}.steps.${index}.image`, step.title),
  ),
})

const normalizePricingPlans = (
  plans: LandingPage['clinicPartners']['pricing']['plans'] | null | undefined,
  fieldPath: string,
): LandingPricingPlan[] =>
  requireLandingArray(plans, fieldPath).map((plan) => ({
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
  team: LandingPage['clinicPartners']['team'] | null | undefined,
  fieldPath: string,
): LandingTeamMember[] =>
  requireLandingArray(team, fieldPath).map((member, index) => {
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

const normalizeAboutTeam = (team: AboutGlobal['team'] | null | undefined): AboutTeamMember[] =>
  requireLandingArray(team, 'about.team').map((member, index) => ({
    name: member.name,
    role: member.role,
    whatWeDo: member.whatWeDo,
    image: resolveRequiredLandingImage(member.image, `about.team.${index}.image`, member.name),
  }))

const normalizeAboutTeamForLanding = (team: AboutGlobal['team'], fieldPath = 'about.team'): LandingTeamMember[] =>
  requireLandingArray(team, fieldPath).map((member, index) => {
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
  section: AboutGlobal['why'] | AboutGlobal['transparency'] | null | undefined,
  fieldPath: string,
): AboutTextSection => {
  const requiredSection = requireLandingSection(section, fieldPath)

  return {
    title: requiredSection.title,
    items: requireLandingArray(requiredSection.items, `${fieldPath}.items`).map((item) => ({ text: item.text })),
  }
}

const normalizeLandingCtaButtonLink = (cta: LandingPage['clinicPartners']['cta']): string => {
  const safeHref = normalizeSafeLandingHref(resolveHrefFromCMSLink(cta.link), { allowInternalPath: true })

  if (!safeHref) {
    throw new Error('Landing CTA link is missing or unsafe')
  }

  return safeHref
}

export const normalizeHomeLandingContent = (landingPages: LandingPage) => {
  const home = requireLandingSection(landingPages.home, 'home')
  const seo = requireLandingSection(home.seo, 'home.seo')
  const hero = requireLandingSection(home.hero, 'home.hero')
  const features = requireLandingSection(home.features, 'home.features')
  const process = requireLandingSection(home.process, 'home.process')
  const faq = requireLandingSection(home.faq, 'home.faq')
  const testimonialsIntro = requireLandingSection(home.testimonialsIntro, 'home.testimonialsIntro')
  const categoriesIntro = requireLandingSection(home.categoriesIntro, 'home.categoriesIntro')
  const blogTeaser = requireLandingSection(home.blogTeaser, 'home.blogTeaser')
  const contact = requireLandingSection(home.contact, 'home.contact')

  return {
    metadata: {
      title: seo.title,
      description: seo.description,
    },
    hero: {
      title: hero.title,
      description: hero.description,
      image: resolveRequiredLandingImage(hero.image, 'home.hero.image', hero.title),
    },
    testimonials: normalizeTestimonials(home.testimonials, 'home.testimonials'),
    testimonialsIntro,
    categoriesIntro,
    features: {
      title: features.title,
      description: features.description,
      backgroundImage: resolveRequiredLandingImage(
        features.backgroundImage,
        'home.features.backgroundImage',
        features.title,
      ).src,
      items: normalizeFeatures(features.items, 'home.features.items'),
    },
    process: normalizeProcess(process, 'home.process'),
    faq: normalizeFaq(faq, 'home.faq'),
    blogTeaser,
    contact,
  } satisfies HomeLandingContent
}

export const normalizeAboutLandingContent = (landingPages: LandingPage) => {
  const about = requireLandingSection(landingPages.about, 'about')
  const seo = requireLandingSection(about.seo, 'about.seo')
  const hero = requireLandingSection(about.hero, 'about.hero')

  return {
    metadata: {
      title: seo.title,
      description: seo.description,
    },
    hero: {
      title: hero.title,
      description: hero.description,
      image: resolveRequiredLandingImage(hero.image, 'about.hero.image', hero.title, 'hero'),
    },
    why: normalizeAboutTextSection(about.why, 'about.why'),
    team: normalizeAboutTeam(about.team),
    transparency: normalizeAboutTextSection(about.transparency, 'about.transparency'),
  } satisfies AboutLandingContent
}

export const normalizeClinicPartnerLandingContent = (landingPages: LandingPage) => {
  const clinicPartners = requireLandingSection(landingPages.clinicPartners, 'clinicPartners')
  const seo = requireLandingSection(clinicPartners.seo, 'clinicPartners.seo')
  const hero = requireLandingSection(clinicPartners.hero, 'clinicPartners.hero')
  const features = requireLandingSection(clinicPartners.features, 'clinicPartners.features')
  const process = requireLandingSection(clinicPartners.process, 'clinicPartners.process')
  const cta = requireLandingSection(clinicPartners.cta, 'clinicPartners.cta')
  const pricing = requireLandingSection(clinicPartners.pricing, 'clinicPartners.pricing')
  const faq = requireLandingSection(clinicPartners.faq, 'clinicPartners.faq')
  const categoriesIntro = requireLandingSection(clinicPartners.categoriesIntro, 'clinicPartners.categoriesIntro')
  const blogTeaser = requireLandingSection(clinicPartners.blogTeaser, 'clinicPartners.blogTeaser')
  const contact = requireLandingSection(clinicPartners.contact, 'clinicPartners.contact')
  const teamIntro = requireLandingSection(clinicPartners.teamIntro, 'clinicPartners.teamIntro')
  const testimonialsIntro = requireLandingSection(clinicPartners.testimonialsIntro, 'clinicPartners.testimonialsIntro')
  const pricingModel = requireLandingArray(clinicPartners.pricingModel, 'clinicPartners.pricingModel')
  const aboutTeam = landingPages.about?.team && landingPages.about.team.length > 0 ? landingPages.about.team : undefined

  return {
    metadata: {
      title: seo.title,
      description: seo.description,
    },
    hero: {
      title: hero.title,
      description: hero.description,
      image: resolveRequiredLandingImage(hero.image, 'clinicPartners.hero.image', hero.title),
    },
    features: {
      title: features.title,
      description: features.description,
      items: normalizeFeatures(features.items, 'clinicPartners.features.items'),
    },
    process: normalizeProcess(process, 'clinicPartners.process'),
    categoriesIntro,
    cta: {
      title: cta.title,
      buttonText: cta.buttonText,
      buttonLink: normalizeLandingCtaButtonLink(cta),
    },
    team: aboutTeam
      ? normalizeAboutTeamForLanding(aboutTeam)
      : normalizeTeam(clinicPartners.team, 'clinicPartners.team'),
    teamIntro,
    testimonials: normalizeTestimonials(clinicPartners.testimonials, 'clinicPartners.testimonials'),
    testimonialsIntro,
    pricing: {
      title: pricing.title,
      description: pricing.description,
      plans: normalizePricingPlans(pricing.plans, 'clinicPartners.pricing.plans'),
    },
    pricingModel: pricingModel.map((item) => ({
      title: item.title,
      description: item.description,
    })),
    faq: normalizeFaq(faq, 'clinicPartners.faq'),
    blogTeaser,
    contact,
  } satisfies ClinicPartnerLandingContent
}

export const getHomeLandingContent = async (): Promise<HomeLandingContent> => {
  const landingPages = (await getCachedGlobal('landingPages', 2)()) as LandingPage | null | undefined

  return normalizeHomeLandingContent(requireLandingPagesGlobal(landingPages))
}

export const getAboutLandingContent = async (): Promise<AboutLandingContent> => {
  const landingPages = (await getCachedGlobal('landingPages', 2)()) as LandingPage | null | undefined

  return normalizeAboutLandingContent(requireLandingPagesGlobal(landingPages))
}

export const getClinicPartnerLandingContent = async (): Promise<ClinicPartnerLandingContent> => {
  const landingPages = (await getCachedGlobal('landingPages', 2)()) as LandingPage | null | undefined

  return normalizeClinicPartnerLandingContent(requireLandingPagesGlobal(landingPages))
}
