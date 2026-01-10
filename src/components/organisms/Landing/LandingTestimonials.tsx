import React from 'react'

import { Container } from '@/components/molecules/Container'

import { LandingTestimonialsCarouselClient } from './LandingTestimonialsCarousel'
export type LandingTestimonial = {
  quote: string
  author: string
  role: string
  image: string
}

type LandingTestimonialsProps = {
  testimonials: LandingTestimonial[]
}

export const LandingTestimonials: React.FC<LandingTestimonialsProps> = ({ testimonials }) => {
  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-16">
          <h2 id="landing-testimonials" className="text-foreground mb-6 text-5xl font-bold">
            Testimonials
          </h2>
          <p className="text-foreground/80 mx-auto max-w-2xl text-xl">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
        </div>

        <LandingTestimonialsCarouselClient testimonials={testimonials} labelledById="landing-testimonials" />
      </Container>
    </section>
  )
}
