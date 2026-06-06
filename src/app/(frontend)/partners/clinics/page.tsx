import React from 'react'
import type { Metadata } from 'next'

import { Heading } from '@/components/atoms/Heading'
import {
  LandingCategories,
  LandingFeatures,
  LandingPricing,
  LandingProcess,
  LandingTeam,
  LandingTestimonials,
} from '@/components/organisms/Landing'
import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { CallToAction } from '@/components/organisms/CallToAction'
import { FAQSection } from '@/components/organisms/FAQ'
import { ScrollReveal } from '@/components/molecules/ScrollReveal'
import { ClinicRegistrationLandingSection } from '../../_components/ClinicRegistrationLandingSection'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { findLatestPosts } from '@/utilities/content/serverData'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { getClinicRegistrationTreatmentCategories } from '@/utilities/clinicRegistration/treatmentCategories'
import { getClinicPartnerLandingContent } from '@/utilities/landing/landingPageContent'
import { getLandingMedicalSpecialtyCategories } from '@/utilities/landing/medicalSpecialtyCategories'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const revalidate = 600

export default async function ClinicLandingPage() {
  const payload = await getPayload({ config: configPromise })
  const [landingContent, posts, landingSpecialtyCategories, clinicRegistrationTreatmentCategories] = await Promise.all([
    getClinicPartnerLandingContent(),
    findLatestPosts(payload, 3),
    getLandingMedicalSpecialtyCategories(payload),
    getClinicRegistrationTreatmentCategories(payload),
  ])

  const normalizedPosts = posts.map((post) => normalizePost(post))
  const partnerContactHref = '#contact'

  return (
    <main className="flex min-h-screen flex-col">
      <LandingHero
        title={landingContent.hero.title}
        description={landingContent.hero.description}
        image={landingContent.hero.image}
      />
      <ScrollReveal>
        <LandingFeatures
          features={landingContent.features.items}
          title={landingContent.features.title}
          description={landingContent.features.description}
        />
      </ScrollReveal>
      <LandingProcess
        title={landingContent.process.title}
        subtitle={landingContent.process.subtitle}
        steps={landingContent.process.steps}
        stepImages={landingContent.process.stepImages}
        stepPercentages={[0, 33.33, 66.67, 100]}
        stepActivationOffsetPx={[0, 28, 48, 0]}
      />
      <ScrollReveal>
        <LandingCategories
          title={landingContent.categoriesIntro.title}
          description={landingContent.categoriesIntro.description}
          categories={landingSpecialtyCategories.categories}
          items={landingSpecialtyCategories.items}
          featuredIds={landingSpecialtyCategories.featuredIds}
        />
      </ScrollReveal>
      <ScrollReveal>
        <section className="py-20">
          <CallToAction
            variant="spotlight"
            richText={
              <Heading as="h2" align="left" className="text-4xl font-bold text-foreground md:text-5xl">
                {landingContent.cta.title}
              </Heading>
            }
            links={[
              {
                href: partnerContactHref,
                label: landingContent.cta.buttonText,
                appearance: 'default',
                size: 'lg',
                className: 'bg-secondary text-white hover:bg-secondary/90',
              },
            ]}
          />
        </section>
      </ScrollReveal>
      <ScrollReveal>
        <LandingTeam
          team={landingContent.team}
          title={landingContent.teamIntro.title}
          description={landingContent.teamIntro.description}
          ctaHref={partnerContactHref}
        />
      </ScrollReveal>
      <ScrollReveal>
        <LandingTestimonials
          testimonials={landingContent.testimonials}
          title={landingContent.testimonialsIntro.title}
          description={landingContent.testimonialsIntro.description}
        />
      </ScrollReveal>
      <ScrollReveal>
        <LandingPricing
          plans={landingContent.pricing.plans}
          title={landingContent.pricing.title}
          description={landingContent.pricing.description}
          modelItems={landingContent.pricingModel}
          ctaHref={partnerContactHref}
        />
      </ScrollReveal>
      <ScrollReveal>
        <FAQSection
          title={landingContent.faq.title}
          description={landingContent.faq.description}
          items={landingContent.faq.items}
        />
      </ScrollReveal>
      {normalizedPosts.length > 0 ? (
        <ScrollReveal>
          <BlogCardCollection
            title={landingContent.blogTeaser.title}
            intro={landingContent.blogTeaser.description}
            posts={normalizedPosts}
          />
        </ScrollReveal>
      ) : null}
      <ScrollReveal>
        <ClinicRegistrationLandingSection
          className="border-t border-site-divider/60"
          id="contact"
          treatmentCategories={clinicRegistrationTreatmentCategories}
        />
      </ScrollReveal>
    </main>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const metadata = (await getClinicPartnerLandingContent()).metadata

  return createSiteMetadata({
    title: typeof metadata.title === 'string' ? metadata.title : null,
    description: metadata.description,
    path: '/partners/clinics',
  })
}
