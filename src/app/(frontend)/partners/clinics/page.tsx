import React from 'react'
import { Metadata } from 'next'

import {
  ClinicBlog,
  ClinicCategories,
  ClinicContact,
  ClinicCTA,
  ClinicFeatures,
  ClinicHero,
  ClinicPricing,
  ClinicProcess,
  ClinicTeam,
  ClinicTestimonials,
} from '@/components/organisms/ClinicLanding'

export const metadata: Metadata = {
  title: 'For Clinics | FindMyDoc',
  description: 'Join our network of top-rated clinics and connect with patients worldwide.',
}

export default function ClinicLandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <ClinicHero />
      <ClinicFeatures />
      <ClinicProcess />
      <ClinicCategories />
      <ClinicCTA />
      <ClinicTeam />
      <ClinicTestimonials />
      <ClinicPricing />
      <ClinicBlog />
      <ClinicContact />
    </main>
  )
}
