import { Target } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import type { LandingPage, Page, PlatformContentMedia } from '@/payload-types'
import {
  normalizeClinicPartnerLandingContent,
  normalizeHomeLandingContent,
} from '@/utilities/landing/landingPageContent'

import { cloneBaselineLandingPages } from '../helpers/landingPagesBaseline'

const buildMedia = (src: string, alt = 'CMS landing image'): PlatformContentMedia =>
  ({
    alt,
    sizes: {
      large: {
        url: src,
        width: 1400,
        height: 900,
      },
    },
  }) as PlatformContentMedia

const attachRequiredMedia = (landingPages: LandingPage): LandingPage => {
  landingPages.home.hero.image = buildMedia('/platform-media/home-hero-large.webp', 'Home hero image')
  landingPages.home.features.backgroundImage = buildMedia(
    '/platform-media/home-features-large.webp',
    'Home feature image',
  )
  landingPages.home.testimonials.forEach((testimonial) => {
    testimonial.image = buildMedia(`/platform-media/${testimonial.author}.webp`, testimonial.author)
  })
  landingPages.home.process.steps.forEach((step) => {
    step.image = buildMedia(`/platform-media/home-process-${step.step}.webp`, step.title)
  })
  landingPages.clinicPartners.hero.image = buildMedia(
    '/platform-media/clinic-partner-hero-large.webp',
    'Clinic partner hero image',
  )
  landingPages.clinicPartners.process.steps.forEach((step) => {
    step.image = buildMedia(`/platform-media/partner-process-${step.step}.webp`, step.title)
  })
  landingPages.clinicPartners.team.forEach((member) => {
    member.image = buildMedia(`/platform-media/${member.name}.webp`, member.name)
  })
  landingPages.clinicPartners.testimonials.forEach((testimonial) => {
    testimonial.image = buildMedia(`/platform-media/${testimonial.author}.webp`, testimonial.author)
  })

  return landingPages
}

describe('landingPageContent normalizers', () => {
  it('maps CMS media, icon keys, and FAQ row IDs for the home landing page', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    const firstFeature = landingPages.home.features.items[0]
    if (!firstFeature) throw new Error('Expected baseline home feature fixture')
    firstFeature.icon = 'target'
    const firstFaq = landingPages.home.faq.items[0]
    if (!firstFaq) throw new Error('Expected baseline home FAQ fixture')
    firstFaq.id = 'payload-row-q1'

    const content = normalizeHomeLandingContent(landingPages)

    expect(content.hero.image).toMatchObject({
      src: '/platform-media/home-hero-large.webp',
      sizes: '(max-width: 1024px) 100vw, 50vw',
      quality: 75,
    })
    expect(content.features.items[0]?.icon).toBe(Target)
    expect('defaultOpenItemId' in content.faq).toBe(false)
    expect(content.faq.items[0]).toEqual({
      id: 'payload-row-q1',
      question: 'How does this platform help clinics gain international patients?',
      answer:
        'By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.',
    })
  })

  it('requires CMS media instead of falling back to public assets', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    ;(landingPages.clinicPartners.hero as { image?: unknown }).image = undefined

    expect(() => normalizeClinicPartnerLandingContent(landingPages)).toThrow(
      'Landing media clinicPartners.hero.image is missing or not populated',
    )
  })

  it('fails fast when a required landing section is missing', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    ;(landingPages as { home?: unknown }).home = undefined

    expect(() => normalizeHomeLandingContent(landingPages)).toThrow('Landing pages global field home is missing')
  })

  it('fails fast when a required landing array is missing', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    ;(landingPages.home.features as { items?: unknown }).items = undefined

    expect(() => normalizeHomeLandingContent(landingPages)).toThrow(
      'Landing pages global field home.features.items is missing',
    )
  })

  it('keeps pricing data while using CMS media for the clinic partner page', () => {
    const content = normalizeClinicPartnerLandingContent(attachRequiredMedia(cloneBaselineLandingPages()))

    expect(content.hero.image).toMatchObject({
      src: '/platform-media/clinic-partner-hero-large.webp',
      sizes: '(max-width: 1024px) 100vw, 50vw',
      quality: 75,
    })
    expect(content.testimonials[0]?.image).toBe('/platform-media/Alex Morgan.webp')
    expect(content.team[0]?.image).toBe('/platform-media/Volkan Kablan.webp')
    expect(content.pricing.plans[0]?.highlights).toEqual([
      'Priority profile visibility',
      'Enhanced trust and profile depth',
      'Built for clinics scaling inbound demand',
    ])
    expect(content.pricingModel).toHaveLength(3)
  })

  it('uses original landing media before thumbnail-only generated sizes', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    const firstProcessStep = landingPages.clinicPartners.process.steps[0]
    if (!firstProcessStep) throw new Error('Expected baseline clinic partner process step')
    firstProcessStep.image = {
      alt: 'Clinic onboarding image',
      url: '/api/platformContentMedia/file/partner-process-step-1-reach-out-v2.webp',
      width: 576,
      height: 968,
      sizes: {
        thumbnail: {
          url: '/api/platformContentMedia/file/partner-process-step-1-reach-out-v2-300x504.webp',
          width: 300,
          height: 504,
        },
      },
    } as PlatformContentMedia

    const content = normalizeClinicPartnerLandingContent(landingPages)

    expect(content.process.stepImages[0]?.src).toBe(
      '/api/platformContentMedia/file/partner-process-step-1-reach-out-v2.webp',
    )
    expect(content.process.stepImages[0]?.sizes).toBe('(max-width: 1024px) 100vw, 50vw')
    expect(content.process.stepImages[0]?.quality).toBe(75)
  })

  it('drops unsafe CMS links before they reach public landing components', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    const firstTeamMember = landingPages.clinicPartners.team[0]
    if (!firstTeamMember) throw new Error('Expected baseline clinic partner team fixture')
    firstTeamMember.socials = {
      github: 'https://github.com/findmydoc-platform',
      instagram: 'https://example.com/phishing',
      linkedin: 'javascript:alert(1)',
    }

    const content = normalizeClinicPartnerLandingContent(landingPages)

    expect(content.cta.buttonLink).toBe('/contact')
    expect(content.team[0]?.socials?.github).toBe('https://github.com/findmydoc-platform')
    expect(content.team[0]?.socials?.instagram).toBeUndefined()
    expect(content.team[0]?.socials?.linkedin).toBeUndefined()

    landingPages.clinicPartners.cta.link = {
      type: 'custom',
      url: 'javascript:alert(1)',
    }

    expect(() => normalizeClinicPartnerLandingContent(landingPages)).toThrow('Landing CTA link is missing or unsafe')
  })

  it('resolves CTA reference links through the shared CMS link shape', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    landingPages.clinicPartners.cta.link = {
      type: 'reference',
      reference: {
        relationTo: 'pages',
        value: {
          slug: 'contact',
        } as Page,
      },
    }

    const content = normalizeClinicPartnerLandingContent(landingPages)

    expect(content.cta.buttonLink).toBe('/contact')
  })
})
