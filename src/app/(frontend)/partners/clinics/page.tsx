import React from 'react'
import { Metadata } from 'next'

import {
  ClinicBlog,
  ClinicCategories,
  ClinicContact,
  ClinicFeatures,
  ClinicPricing,
  ClinicProcess,
  ClinicTeam,
  ClinicTestimonials,
} from '@/components/organisms/ClinicLanding'
import { ClinicLandingHero } from '@/components/organisms/Heroes/ClinicLanding'
import { CallToAction } from '@/components/organisms/CallToAction'
import { clinicHeroData, clinicCTAData } from '@/stories/fixtures/clinics'

export const metadata: Metadata = {
  title: 'For Clinics | FindMyDoc',
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
      <ClinicFeatures />
      <ClinicProcess />
      <ClinicCategories />
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
      <ClinicTeam />
      <ClinicTestimonials />
      <ClinicPricing />
      <ClinicBlog />
      <ClinicContact />
    </main>
  )
}
