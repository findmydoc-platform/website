import React from 'react'
import { Metadata } from 'next'

import { Heading } from '@/components/atoms/Heading'
import {
  LandingCategoriesClient,
  LandingContact,
  LandingFeatures,
  LandingPricing,
  LandingProcess,
  LandingTeam,
  LandingTestimonials,
} from '@/components/organisms/Landing'
import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import {
  clinicBlogData,
  clinicCategoriesData,
  clinicCategoryFeaturedIds,
  clinicCategoryItems,
  clinicCTAData,
  clinicPartnersFaqSection,
  clinicFeaturesData,
  clinicHeroData,
  clinicPricingData,
  clinicProcessData,
  clinicTeamData,
  clinicTestimonialsData,
} from '@/stories/fixtures/listings'
import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { CallToAction } from '@/components/organisms/CallToAction'
import { FAQSection } from '@/components/organisms/FAQ'
import {
  landingProcessPlaceholderStepImages,
  landingProcessPlaceholderSubtitle,
  landingProcessPlaceholderTitle,
} from '@/utilities/placeholders/landingProcess'

// TODO: Temporary fixtures for layout; replace with Payload data.

export const metadata: Metadata = {
  title: 'For Partner Clinics | findmydoc',
  description:
    'Increase your clinic’s international reach and connect with qualified patients worldwide. Our comparison platform helps clinics, medical networks, and international patient departments gain visibility, trust, and high-intent inquiries - globally and sustainably.',
}

export default function ClinicLandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <LandingHero title={clinicHeroData.title} description={clinicHeroData.description} image={clinicHeroData.image} />
      <LandingFeatures
        features={clinicFeaturesData}
        title="Features"
        description="Increase your clinic’s visibility, attract qualified patients, and grow internationally through transparent, verified profiles."
      />
      <LandingProcess
        title={landingProcessPlaceholderTitle}
        subtitle={landingProcessPlaceholderSubtitle}
        steps={clinicProcessData}
        stepImages={landingProcessPlaceholderStepImages}
      />
      <LandingCategoriesClient
        title="Our Categories"
        description="Showcase your clinic under the categories patients search most."
        categories={clinicCategoriesData}
        items={clinicCategoryItems}
        featuredIds={clinicCategoryFeaturedIds}
      />
      <section className="py-20">
        <CallToAction
          variant="spotlight"
          richText={
            <Heading as="h2" align="left" className="text-4xl font-bold text-foreground md:text-5xl">
              {clinicCTAData.title}
            </Heading>
          }
          links={[
            {
              href: clinicCTAData.buttonLink,
              label: clinicCTAData.buttonText,
              appearance: 'default',
              size: 'lg',
              className: 'bg-secondary text-white hover:bg-secondary/90',
            },
          ]}
        />
      </section>
      <LandingTeam
        team={clinicTeamData}
        title="Our Team"
        description="We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology. Our focus is simple: helping clinics gain international patients in a sustainable, ethical, and measurable way."
      />
      <LandingTestimonials
        testimonials={clinicTestimonialsData}
        title="Testimonials"
        description="Clinics and medical networks trust our platform to expand their international patient acquisition. Our partners value transparency, lead quality, and long-term cooperation over short-term marketing promises."
      />
      <LandingPricing
        plans={clinicPricingData}
        title="Pricing"
        description="Our pricing model is transparent and designed for clinics of different sizes."
      />
      <FAQSection
        title={clinicPartnersFaqSection.title}
        description={clinicPartnersFaqSection.description}
        items={clinicPartnersFaqSection.items}
        defaultOpenItemId={clinicPartnersFaqSection.defaultOpenItemId}
      />
      <BlogCardCollection
        posts={clinicBlogData.map((p) => ({
          title: p.title,
          excerpt: p.excerpt,
          dateLabel: p.date,
          image: p.image ? { src: p.image, alt: p.title } : undefined,
        }))}
      />
      <LandingContact
        title="Kontakt"
        description="Interested in gaining international patients and increasing your clinic’s global reach? Contact us to explore how your clinic can benefit from our international comparison platform."
      />
    </main>
  )
}
