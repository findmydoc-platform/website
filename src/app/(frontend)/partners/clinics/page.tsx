import React from 'react'
import { Metadata } from 'next'

import {
  ClinicCategories,
  ClinicContact,
  ClinicFeatures,
  ClinicPricing,
  ClinicProcess,
  ClinicTeam,
  ClinicTestimonials,
} from '@/components/organisms/ClinicLanding'
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
} from '@/stories/fixtures/clinics'
import { ClinicLandingHero } from '@/components/organisms/Heroes/ClinicLanding'
import { CallToAction } from '@/components/organisms/CallToAction'

export const metadata: Metadata = {
  title: 'For Clinics | findmydoc',
  description: 'Join our network of top-rated clinics and connect with patients worldwide.',
}

export default function ClinicLandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <ClinicLandingHero
        title={clinicHeroData.title}
        description={clinicHeroData.description}
        image={clinicHeroData.image}
      />
      <ClinicFeatures features={clinicFeaturesData} />
      <ClinicProcess steps={clinicProcessData} />
      <ClinicCategories categories={clinicCategoriesData} images={clinicCategoryImages} />
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
      <ClinicTeam team={clinicTeamData} />
      <ClinicTestimonials testimonials={clinicTestimonialsData} />
      <ClinicPricing plans={clinicPricingData} />
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
      <ClinicContact />
    </main>
  )
}
