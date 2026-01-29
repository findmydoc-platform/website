import React from 'react'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'

import { LandingTestimonialsCarouselClient } from './LandingTestimonialsCarousel'
import type { LandingTestimonial } from './LandingTestimonials.types'

type LandingTestimonialsProps = {
  testimonials: LandingTestimonial[]
}

export const LandingTestimonials: React.FC<LandingTestimonialsProps> = ({ testimonials }) => {
  return (
    <section className="bg-white py-20">
      <Container>
        <SectionHeading
          className="mb-16"
          title={<span id="landing-testimonials">Testimonials</span>}
          description="Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos."
          size="section"
          align="center"
        />

        <LandingTestimonialsCarouselClient testimonials={testimonials} labelledById="landing-testimonials" />
      </Container>
    </section>
  )
}
