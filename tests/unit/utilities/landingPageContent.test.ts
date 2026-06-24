import { Target } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import type { LandingPage, Page, PlatformContentMedia } from '@/payload-types'
import {
  normalizeAboutLandingContent,
  normalizeClinicPartnerLandingContent,
  normalizeHomeLandingContent,
} from '@/utilities/landing/landingPageContent'

import { cloneBaselineLandingPages } from '../helpers/landingPagesBaseline'

const buildMedia = (
  src: string,
  alt = 'CMS landing image',
  focalPoint?: { x: number; y: number },
): PlatformContentMedia =>
  ({
    alt,
    ...(focalPoint ? { focalX: focalPoint.x, focalY: focalPoint.y } : {}),
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
  landingPages.about.hero.image = buildMedia('/platform-media/about-hero-large.webp', 'About hero image', {
    x: 44,
    y: 42,
  })
  landingPages.about.team.forEach((member, index) => {
    member.image = buildMedia(`/platform-media/about-${member.name}.webp`, member.name, {
      x: 50 + index,
      y: 38 + index,
    })
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

  it('maps about page hero, statements, team responsibilities, and transparency content', () => {
    const content = normalizeAboutLandingContent(attachRequiredMedia(cloneBaselineLandingPages()))

    expect(content.hero.image).toMatchObject({
      src: '/platform-media/about-hero-large.webp',
      sizes: '100vw',
      quality: 75,
      objectPosition: '44% 42%',
    })
    expect(content.why.items).toHaveLength(3)
    expect(content.team[0]).toMatchObject({
      name: 'Volkan Kablan',
      role: 'CEO',
      whatWeDo:
        'Sets partner standards so commercial decisions stay transparent and aligned with responsible clinic relationships.',
      image: {
        src: '/platform-media/about-Volkan Kablan.webp',
        objectPosition: '50% 38%',
      },
    })
    expect(content.transparency.items.map((item) => item.text)).toEqual([
      'Clinics remain accountable for the information shown on their profiles.',
      'Qualification and evidence signals are reviewed before they are presented as trust context.',
      'Comparison context stays separate from medical advice, and patients contact clinics directly.',
    ])
  })

  it('uses about team as the central team source for the clinic partner page', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    const firstAboutMember = landingPages.about.team[0]
    if (!firstAboutMember) throw new Error('Expected baseline about team fixture')
    firstAboutMember.name = 'About Source Member'
    firstAboutMember.role = 'Platform Lead'
    firstAboutMember.image = buildMedia('/platform-media/about-source-member.webp', 'About source member', {
      x: 34,
      y: 61,
    })

    const content = normalizeClinicPartnerLandingContent(landingPages)

    expect(content.team[0]).toMatchObject({
      name: 'About Source Member',
      role: 'Platform Lead',
      image: '/platform-media/about-source-member.webp',
      imageObjectPosition: '34% 61%',
      isPhoto: true,
      photoDisplay: 'original',
    })
    expect(content.team[0]?.socials).toBeUndefined()
  })

  it('falls back to the legacy clinic partner team when about team is empty', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    landingPages.about.team = []

    const content = normalizeClinicPartnerLandingContent(landingPages)

    expect(content.team[0]).toMatchObject({
      name: 'Volkan Kablan',
      image: '/platform-media/Volkan Kablan.webp',
    })
  })

  it('requires CMS media for the about page', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    ;(landingPages.about.hero as { image?: unknown }).image = undefined

    expect(() => normalizeAboutLandingContent(landingPages)).toThrow(
      'Landing media about.hero.image is missing or not populated',
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
    expect(content.team[0]?.image).toBe('/platform-media/about-Volkan Kablan.webp')
    expect(content.team[0]?.socials).toBeUndefined()
    expect(content.pricing.plans[0]?.highlights).toEqual([
      'Priority profile visibility',
      'Enhanced trust and profile depth',
      'Built for clinics scaling inbound demand',
    ])
    expect(content.pricingModel).toHaveLength(3)
    expect(content.registrationIntro).toEqual({
      title: 'Ready for verified visibility?',
      description: 'Share the key details. We review your request personally and follow up with the next steps.',
    })
    expect(content.teamCta).toEqual({
      buttonText: 'About us',
      buttonLink: '/about',
    })
  })

  it('fails fast when the clinic partner registration intro is missing', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    ;(landingPages.clinicPartners as { registrationIntro?: unknown }).registrationIntro = undefined

    expect(() => normalizeClinicPartnerLandingContent(landingPages)).toThrow(
      'Landing pages global field clinicPartners.registrationIntro is missing',
    )
  })

  it('fails fast when the clinic partner team CTA is missing', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    ;(landingPages.clinicPartners as { teamCta?: unknown }).teamCta = undefined

    expect(() => normalizeClinicPartnerLandingContent(landingPages)).toThrow(
      'Landing pages global field clinicPartners.teamCta is missing',
    )
  })

  it('normalizes clinic partner CTA labels before rendering', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    landingPages.clinicPartners.cta.buttonText = '  Contact us  '
    landingPages.clinicPartners.teamCta.buttonText = '  About us  '

    const content = normalizeClinicPartnerLandingContent(landingPages)

    expect(content.cta.buttonText).toBe('Contact us')
    expect(content.teamCta.buttonText).toBe('About us')
  })

  it('fails fast when the clinic partner team CTA label is blank', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    landingPages.clinicPartners.teamCta.buttonText = '   '

    expect(() => normalizeClinicPartnerLandingContent(landingPages)).toThrow(
      'Landing CTA text clinicPartners.teamCta.buttonText is missing',
    )
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
    landingPages.about.team = []
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

    expect(() => normalizeClinicPartnerLandingContent(landingPages)).toThrow(
      'Landing CTA link clinicPartners.cta.link is missing or unsafe',
    )
  })

  it('drops unsafe clinic partner team CTA links before they reach public landing components', () => {
    const landingPages = attachRequiredMedia(cloneBaselineLandingPages())
    landingPages.clinicPartners.teamCta.link = {
      type: 'custom',
      url: 'javascript:alert(1)',
    }

    expect(() => normalizeClinicPartnerLandingContent(landingPages)).toThrow(
      'Landing CTA link clinicPartners.teamCta.link is missing or unsafe',
    )
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
