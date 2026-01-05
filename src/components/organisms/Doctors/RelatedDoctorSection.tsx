import * as React from 'react'

import { cn } from '@/utilities/ui'

import { RelatedDoctorCarousel, type RelatedDoctorCarouselProps } from './RelatedDoctorSection.client'

export type RelatedDoctorSectionProps = RelatedDoctorCarouselProps & {
  title?: string
}

export function RelatedDoctorSection({ title = 'Related Doctor', className, ...props }: RelatedDoctorSectionProps) {
  return (
    <section className={cn('w-full', className)}>
      <div className="mb-8 lg:mb-12">
        <h2 className="text-size-72 font-bold text-secondary text-center">{title}</h2>
      </div>

      <RelatedDoctorCarousel {...props} />
    </section>
  )
}
