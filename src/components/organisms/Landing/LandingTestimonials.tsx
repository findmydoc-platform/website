import React from 'react'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { cn } from '@/utilities/ui'

import { LandingTestimonialsCarouselClient } from './LandingTestimonialsCarousel'
import type { LandingTestimonial } from './LandingTestimonials.types'

type LandingTestimonialsProps = {
  testimonials: LandingTestimonial[]
  title: string
  description: string
  className?: string
}
export const LandingTestimonials: React.FC<LandingTestimonialsProps> = ({
  testimonials,
  title,
  description,
  className,
}) => {
  return (
    <section className={cn('bg-white py-16 sm:py-20', className)}>
      <Container>
        <SectionHeading
          className="mb-10 sm:mb-12 md:mb-16"
          title={title}
          titleId="landing-testimonials"
          description={description}
          size="section"
          align="center"
        />

        <LandingTestimonialsCarouselClient testimonials={testimonials} labelledById="landing-testimonials" />
      </Container>
    </section>
  )
}
