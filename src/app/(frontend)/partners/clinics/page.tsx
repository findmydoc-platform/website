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
        title="Our Process"
        subtitle="Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos."
        steps={clinicProcessData}
        stepImages={[
          { src: '/images/process-step-1.svg', alt: 'Process step 1 visual' },
          { src: '/images/process-step-2.svg', alt: 'Process step 2 visual' },
          { src: '/images/process-step-3.svg', alt: 'Process step 3 visual' },
          { src: '/images/process-step-4.svg', alt: 'Process step 4 visual' },
        ]}
      />
      <LandingCategories categories={clinicCategoriesData} images={clinicCategoryImages} />
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
      <LandingTeam team={clinicTeamData} />
      <LandingTestimonials testimonials={clinicTestimonialsData} />
      <LandingPricing plans={clinicPricingData} />
      <section className="py-20">
        <div className="container">
          <BlogCardCollection
            posts={clinicBlogData.map((p) => ({
              title: p.title,
              excerpt: p.excerpt,
              dateLabel: p.date,
              image: p.image ? { src: p.image, alt: p.title } : undefined,
            }))}
          />
        </div>
      </section>
      <LandingContact />
    </main>
  )
}
