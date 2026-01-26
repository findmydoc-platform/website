import React from 'react'

import { Container } from '@/components/molecules/Container'

import { LandingTestimonialsCarouselClient } from './LandingTestimonialsCarousel'
import type { LandingTestimonial } from './LandingTestimonials.types'

type LandingTestimonialsProps = {
  testimonials: LandingTestimonial[]
}

export const LandingTestimonials: React.FC<LandingTestimonialsProps> = ({ testimonials }) => {
  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-16">
          <h2 id="landing-testimonials" className="mb-6 text-5xl font-bold text-foreground">
            Testimonials
          </h2>
          <p className="mx-auto max-w-2xl text-xl text-foreground/80">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
        </div>

        <LandingTestimonialsCarouselClient testimonials={testimonials} labelledById="landing-testimonials" />
      </Container>
    </section>
  )
}
