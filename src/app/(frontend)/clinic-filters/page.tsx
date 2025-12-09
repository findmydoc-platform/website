import React from 'react'
import { FeatureHero } from '@/components/organisms/Heroes/FeatureHero'
import medicalHero from '@/stories/assets/medical-hero.jpg'

export default function ClinicFiltersPage() {
  return (
    <FeatureHero
      title="Find the Right Clinic for You"
      subtitle="Connect with top-rated medical professionals worldwide."
      features={['Verified Clinics', 'Transparent Pricing', 'Patient Reviews', '24/7 Support']}
      media={medicalHero.src}
    />
  )
}
