import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

type ClinicTestimonial = {
  quote: string
  author: string
  role: string
  image: string
}

type ClinicTestimonialsProps = {
  testimonials: ClinicTestimonial[]
}

export const ClinicTestimonials: React.FC<ClinicTestimonialsProps> = ({ testimonials }) => {
  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-16">
          <h2 className="mb-6 text-5xl font-bold text-foreground">Testimonials</h2>
          <p className="max-w-2xl text-xl text-foreground/80">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => {
            const isHighlighted = index === 0
            return (
              <div
                key={index}
                className={cn(
                  'flex flex-col justify-between rounded-[40px] p-8 shadow-sm',
                  isHighlighted ? 'bg-primary text-white' : 'bg-white border border-border text-foreground',
                )}
              >
                <p
                  className={cn(
                    'mb-8 text-lg font-medium leading-relaxed',
                    isHighlighted ? 'text-white' : 'text-muted-foreground',
                  )}
                >
                  &quot;{testimonial.quote}&quot;
                </p>

                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-full">
                    <Image src={testimonial.image} alt={testimonial.author} fill className="object-cover" />
                  </div>
                  <div>
                    <h4 className={cn('text-xl font-bold', isHighlighted ? 'text-white' : 'text-foreground')}>
                      {testimonial.author}
                    </h4>
                    <p className={cn('text-sm font-bold', isHighlighted ? 'text-white/80' : 'text-foreground')}>
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Slider dots placeholder */}
        <div className="mt-12 flex justify-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <div className="h-3 w-3 rounded-full bg-border" />
          <div className="h-3 w-3 rounded-full bg-border" />
        </div>
      </Container>
    </section>
  )
}
