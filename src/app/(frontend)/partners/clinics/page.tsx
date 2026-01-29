import React from 'react'
import { Metadata } from 'next'

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
        title="Why partner with us"
        description="Increase your clinic’s visibility, attract qualified patients, and grow internationally through transparent, verified profiles."
      />
      <LandingProcess
        title={landingProcessPlaceholderTitle}
        subtitle={landingProcessPlaceholderSubtitle}
        steps={clinicProcessData}
        stepImages={landingProcessPlaceholderStepImages}
      />
      <LandingCategoriesClient
        title="Top Treatment Categories"
        description="Showcase your clinic under the categories patients search most."
        categories={clinicCategoriesData}
        items={clinicCategoryItems}
        featuredIds={clinicCategoryFeaturedIds}
      />
      <section className="py-20">
        <CallToAction
          variant="spotlight"
          richText={<h2 className="text-4xl font-bold text-foreground md:text-5xl">{clinicCTAData.title}</h2>}
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
        subtext="We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology. Our focus is simple: helping clinics gain international patients in a sustainable, ethical, and measurable way."
      />
      <LandingTestimonials
        testimonials={clinicTestimonialsData}
        title="Testimonials"
        description="What our partners say about working with us."
      />
      <LandingPricing
        plans={clinicPricingData}
        title="Pricing"
        description="Flexible pricing and partnership options to suit clinics of any size."
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
        title="Contact"
        description="Reach out to discuss partnerships, integrations, or international patient programs."
      />
    </main>
  )
}
