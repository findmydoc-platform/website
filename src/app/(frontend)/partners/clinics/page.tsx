import React from 'react'
import { Metadata } from 'next'

import {
  LandingCategories,
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
  clinicCategoryImages,
  clinicCTAData,
  clinicFeaturesData,
  clinicHeroData,
  clinicPricingData,
  clinicProcessData,
  clinicTeamData,
  clinicTestimonialsData,
} from '@/stories/fixtures/listings'
import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { CallToAction } from '@/components/organisms/CallToAction'
import {
  landingProcessPlaceholderStepImages,
  landingProcessPlaceholderSubtitle,
  landingProcessPlaceholderTitle,
} from '@/utilities/placeholders/landingProcess'

export const metadata: Metadata = {
  title: 'For Clinics | findmydoc',
  description: 'Join our network of top-rated clinics and connect with patients worldwide.',
}

export default function ClinicLandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <LandingHero title={clinicHeroData.title} description={clinicHeroData.description} image={clinicHeroData.image} />
      <LandingFeatures features={clinicFeaturesData} />
      <LandingProcess
        title={landingProcessPlaceholderTitle}
        subtitle={landingProcessPlaceholderSubtitle}
        steps={clinicProcessData}
        stepImages={landingProcessPlaceholderStepImages}
      />
      <LandingCategories categories={clinicCategoriesData} images={clinicCategoryImages} />
      <section className="py-20">
        <CallToAction
          variant="spotlight"
          richText={<h2 className="text-foreground text-4xl font-bold md:text-5xl">{clinicCTAData.title}</h2>}
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
      <LandingTeam team={clinicTeamData} />
      <LandingTestimonials testimonials={clinicTestimonialsData} />
      <LandingPricing plans={clinicPricingData} />
      <BlogCardCollection
        posts={clinicBlogData.map((p) => ({
          title: p.title,
          excerpt: p.excerpt,
          dateLabel: p.date,
          image: p.image ? { src: p.image, alt: p.title } : undefined,
        }))}
      />
      <LandingContact />
    </main>
  )
}
