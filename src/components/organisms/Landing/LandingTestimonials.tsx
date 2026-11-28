import React from 'react'

import { Container } from '@/components/molecules/Container'
import { SectionHeading, type SectionHeadingProps } from '@/components/molecules/SectionHeading'
import { cn } from '@/utilities/ui'

import { LandingTestimonialsCarouselClient } from './LandingTestimonialsCarousel'
import type { LandingTestimonial } from './LandingTestimonials.types'

type LandingTestimonialsProps = {
  testimonials: LandingTestimonial[]
  title: string
  description: string
  headingTone?: SectionHeadingProps['tone']
  className?: string
}
export const LandingTestimonials: React.FC<LandingTestimonialsProps> = ({
  testimonials,
  title,
  description,
  headingTone,
  className,
}) => {
  return (
    <section className={cn('bg-site-canvas py-16 sm:py-20', className)}>
      <Container>
        <SectionHeading
          className="mb-10 sm:mb-12 md:mb-16"
          title={title}
          titleId="landing-testimonials"
          description={description}
          size="section"
          align="center"
          tone={headingTone}
        />

        <LandingTestimonialsCarouselClient testimonials={testimonials} labelledById="landing-testimonials" />
      </Container>
    </section>
  )
}
