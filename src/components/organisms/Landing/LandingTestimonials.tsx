import React from 'react'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'

import { LandingTestimonialsCarouselClient } from './LandingTestimonialsCarousel'
import type { LandingTestimonial } from './LandingTestimonials.types'

type LandingTestimonialsProps = {
  testimonials: LandingTestimonial[]
  title: React.ReactNode
  description: React.ReactNode
}
export const LandingTestimonials: React.FC<LandingTestimonialsProps> = ({ testimonials, title, description }) => {
  return (
    <section className="bg-white py-20">
      <Container>
        <SectionHeading
          className="mb-16"
          title={<span id="landing-testimonials">{title}</span>}
          description={description}
          size="section"
          align="center"
        />

        <LandingTestimonialsCarouselClient testimonials={testimonials} labelledById="landing-testimonials" />
      </Container>
    </section>
  )
}
